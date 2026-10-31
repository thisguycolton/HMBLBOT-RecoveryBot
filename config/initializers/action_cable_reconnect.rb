# Action Cable's Postgres adapter keeps one database connection open to LISTEN for broadcasts,
# and runs it on a thread that takes the whole process down on any error. When that connection
# is dropped (Postgres restarts, or the Docker network closes a quiet connection), the next
# LISTEN raises PG::ConnectionBad and Puma exits until CapRover restarts the container.
#
# This keeps the listener running instead: it opens a new connection, LISTENs again on every
# channel that still has subscribers, and carries on. Broadcasts sent during the second or two
# it takes to reconnect are missed, which is far less than a restart used to lose.
#
# The loop below is Action Cable 8.0.1's Listener#listen, plus the reconnect. Check it again
# when upgrading Rails.
require "action_cable/subscription_adapter/postgresql"

module ActionCablePostgresReconnect
  RETRY_LIMIT_SECONDS = 10

  def listen
    failures = 0
    loop do
      action = nil
      begin
        @adapter.with_subscriptions_connection do |pg_conn|
          resubscribe if failures.positive?
          failures = 0

          catch :shutdown do
            loop do
              until @queue.empty?
                action = @queue.pop(true)
                kind, channel, callback = action

                case kind
                when :listen
                  pg_conn.exec("LISTEN #{pg_conn.escape_identifier channel}")
                  @event_loop.post(&callback) if callback
                when :unlisten
                  pg_conn.exec("UNLISTEN #{pg_conn.escape_identifier channel}")
                when :shutdown
                  throw :shutdown
                end
                action = nil
              end

              pg_conn.wait_for_notify(1) do |chan, _pid, message|
                broadcast(chan, message)
              end
            end
          end
        end
        return
      rescue PG::Error, ActiveRecord::ConnectionNotEstablished => e
        failures += 1
        # Try the action that was running again, so a member who was subscribing still gets
        # their confirmation, and stop here if the server is shutting down.
        pending = [action].compact
        pending << @queue.pop(true) until @queue.empty?
        return if pending.any? { |kind, *| kind == :shutdown }
        pending.each { |item| @queue.push(item) }
        Rails.logger.warn("[action cable] lost the Postgres LISTEN connection (#{e.class}: #{e.message.lines.first&.strip}); reconnecting")
        sleep [failures, RETRY_LIMIT_SECONDS].min
      end
    end
  end

  private

  # LISTEN is per connection, so a new one has to hear every channel again.
  def resubscribe
    channels = @sync.synchronize { @subscribers.keys }
    channels.each { |channel| @queue.push([:listen, channel, nil]) }
  end
end

ActionCable::SubscriptionAdapter::PostgreSQL::Listener.prepend(ActionCablePostgresReconnect)
