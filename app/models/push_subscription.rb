# One browser or home-screen app that gets Web Push notifications for an account. Made from
# account settings (Api::PushSubscriptionsController); WebPushSender sends each Notification to
# all of the account's subscriptions and drops ones the push service says are gone.
class PushSubscription < ApplicationRecord
  belongs_to :user

  # The push services browsers use (Chrome/Edge/Android: Google; Firefox: Mozilla; Safari and
  # iOS: Apple; Edge on Windows: Microsoft). The server posts to the endpoint, so anything else
  # is refused rather than letting someone point it at another address.
  PUSH_HOSTS = %w[fcm.googleapis.com android.googleapis.com push.services.mozilla.com push.apple.com notify.windows.com].freeze

  validates :endpoint, presence: true, uniqueness: true, length: { maximum: 2000 }
  validates :p256dh, :auth, presence: true, length: { maximum: 200 }
  validate :endpoint_on_a_push_service

  def self.push_service?(url)
    uri = URI.parse(url.to_s)
    uri.is_a?(URI::HTTPS) && uri.userinfo.nil? && [nil, 443].include?(uri.port) &&
      PUSH_HOSTS.any? { |host| uri.host == host || uri.host.to_s.end_with?(".#{host}") }
  rescue URI::InvalidURIError
    false
  end

  # "Safari on iPhone", "Chrome on Android", "Firefox on Mac"
  def device_label
    ua = user_agent.to_s
    browser = case ua
              when /Edg\//i then "Edge"
              when /SamsungBrowser/i then "Samsung Internet"
              when /Firefox|FxiOS/i then "Firefox"
              when /Chrome|CriOS/i then "Chrome"
              when /Safari/i then "Safari"
              end
    device = case ua
             when /iPhone/i then "iPhone"
             when /iPad/i then "iPad"
             when /Android/i then "Android"
             when /Macintosh|Mac OS X/i then "Mac"
             when /Windows/i then "Windows"
             when /CrOS/i then "Chromebook"
             when /Linux/i then "Linux"
             end
    [browser, device].compact.join(" on ").presence || "A browser"
  end

  def as_api_json(current_endpoint = nil)
    { id: id, label: device_label, created_at: created_at.iso8601, last_sent_at: last_sent_at&.iso8601, this_device: endpoint == current_endpoint }
  end

  private

  def endpoint_on_a_push_service
    errors.add(:endpoint, "isn't a browser push service") if endpoint.present? && !self.class.push_service?(endpoint)
  end
end
