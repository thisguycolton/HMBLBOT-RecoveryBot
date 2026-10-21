# Sends Web Push notifications (the web-push gem). Needs a VAPID key pair in the environment:
# VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (make them with `bin/rails web_push:keys`), and
# optionally VAPID_SUBJECT (a mailto: or https: address the push services can reach us at).
# Without the keys push is off: account settings don't offer it and nothing is sent.
#
# What's sent is encrypted for the browser, so the push service (Apple, Google, Mozilla,
# Microsoft) only passes it along and can't read it.
module WebPushSender
  TTL = 1.day.to_i

  module_function

  def configured?
    public_key.present? && ENV["VAPID_PRIVATE_KEY"].present?
  end

  def public_key
    ENV["VAPID_PUBLIC_KEY"].presence
  end

  def subject
    ENV["VAPID_SUBJECT"].presence || "mailto:support@hmblbot.com"
  end

  # Every device the notification's account turned push on for, unless they turned that kind off
  def deliver(notification)
    return unless configured? && notification.user.wants_push?(notification.kind)

    payload = payload_for(notification)
    notification.user.push_subscriptions.find_each { |sub| send_to(sub, payload) }
  end

  def payload_for(notification)
    { title: notification.title, body: notification.body.to_s, tag: "n-#{notification.id}", id: notification.id,
      url: notification.open_path, unread: notification.user.notifications.unread.count }
  end

  # true once the push service takes it; a subscription the service says is gone is deleted
  def send_to(subscription, payload)
    WebPush.payload_send(
      message: payload.to_json, endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth,
      ttl: TTL, urgency: "normal", vapid: { subject: subject, public_key: public_key, private_key: ENV["VAPID_PRIVATE_KEY"] },
    )
    subscription.update_column(:last_sent_at, Time.current)
    true
  rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription
    subscription.destroy
    false
  rescue WebPush::Error, SocketError, Timeout::Error, SystemCallError, OpenSSL::SSL::SSLError => e
    Rails.logger.warn("[web push] #{subscription.id}: #{e.class} #{e.message.to_s.truncate(200)}")
    false
  end
end
