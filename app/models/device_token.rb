# One install of the iPhone or Android app that gets notifications for an account: its
# Firebase Cloud Messaging token. Made from account settings in the app
# (Api::PushSubscriptionsController#app_create); FcmSender sends each Notification to all of an
# account's devices and drops tokens Firebase says are gone. Logging out of the app drops it
# (lib/push.js forgetPushAfterSignOut), the same rule as Web Push.
class DeviceToken < ApplicationRecord
  PLATFORMS = %w[ios android].freeze

  belongs_to :user

  validates :token, presence: true, uniqueness: true, length: { maximum: 4096 }
  validates :platform, inclusion: { in: PLATFORMS }

  def label = platform == "ios" ? "RecoveryBot app on iPhone" : "RecoveryBot app on Android"

  # Settings list it with the browsers; its id says it's an app ("app-12")
  def as_api_json(current_token = nil)
    { id: "app-#{id}", label: label, app: true, created_at: created_at.iso8601, last_sent_at: last_sent_at&.iso8601,
      this_device: current_token.present? && token == current_token }
  end
end
