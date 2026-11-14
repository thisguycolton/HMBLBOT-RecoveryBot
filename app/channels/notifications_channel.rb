# Each signed-in page's bell (NotificationBell.jsx, on the web and in the apps) hears when the
# account gets a new notification and fetches the list again, so it shows without a refresh or
# waiting for the next poll. The message carries nothing but "changed".
class NotificationsChannel < ApplicationCable::Channel
  def subscribed
    current_user ? stream_for(current_user) : reject
  end

  def self.changed(user)
    broadcast_to(user, { changed: true })
  rescue StandardError => e
    Rails.logger.warn("[notifications] broadcast failed: #{e.message}")
  end
end
