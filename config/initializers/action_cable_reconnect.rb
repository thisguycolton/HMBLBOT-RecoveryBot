# The production cable (config/cable.yml) keeps one Postgres connection open to LISTEN. When the
# database drops it (a restart, or Docker's network closing a connection that sat quiet), Rails
# 8.0's listener thread raises with abort_on_exception on, and that takes all of Puma down with
# it until CapRover starts the app again. Instead, connect again (waiting a little longer each
# time) and LISTEN again on every stream someone is still subscribed to. Anything broadcast while
# it was gone is missed; pages fetch again when they reconnect.
require "action_cable/subscription_adapter/postgresql"

module ActionCablePostgresReconnect
  RETRY_WAITS = [1, 2, 5, 10, 30].freeze

  def listen
    failures = 0
    begin
      started = Time.now
      super
    rescue PG::ConnectionBad, PG::UnableToSend, ActiveRecord::ConnectionNotEstablished => e
      failures = 0 if Time.now - started > 60
      wait = RETRY_WAITS[[failures, RETRY_WAITS.size - 1].min]
      failures += 1
      Rails.logger.warn("[ActionCable] Lost the Postgres LISTEN connection (#{e.class}: #{e.message.lines.first&.strip}); connecting again in #{wait}s")
      sleep wait
      @sync.synchronize { @subscribers.each_key { |channel| @queue.push([:listen, channel, nil]) } }
      retry
    end
  end
end

ActionCable::SubscriptionAdapter::PostgreSQL::Listener.prepend(ActionCablePostgresReconnect)
