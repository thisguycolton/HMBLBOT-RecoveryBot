# Site Admin > Task board (SCRUMBLBOT) pages hear when any task or column changes and fetch the
# board again, so two admins see each other's moves. Site admins only; the message carries
# nothing but "changed".
class AdminTasksChannel < ApplicationCable::Channel
  STREAM = "admin_tasks".freeze

  def subscribed
    current_user&.suite_admin? ? stream_from(STREAM) : reject
  end

  def self.changed
    ActionCable.server.broadcast(STREAM, { changed: true })
  rescue StandardError => e
    Rails.logger.warn("[admin tasks] broadcast failed: #{e.message}")
  end
end
