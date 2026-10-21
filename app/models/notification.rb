# Something for one account to see in the notification center (the bell in the nav).
# Create them with Notification.deliver; the nav polls Api::NotificationsController.
class Notification < ApplicationRecord
  belongs_to :user

  validates :kind, :title, presence: true

  # Also sent to the account's devices that turned on push (WebPushSender)
  after_create_commit :push_later, if: -> { WebPushSender.configured? && user.push_subscriptions.exists? }

  scope :unread, -> { where(read_at: nil) }
  scope :recent, -> { order(created_at: :desc, id: :desc) }

  # Notification.deliver(users, kind: "text_report.created", title: "...", body: "...", url: "/...")
  def self.deliver(users, kind:, title:, body: nil, url: nil)
    Array(users).uniq.each { |user| create!(user: user, kind: kind, title: title, body: body&.truncate(300), url: url) }
  end

  def read? = read_at.present?

  # Where a push notification's tap goes: marks it read, then on to its url
  def open_path = "/notifications/#{id}/open"

  def as_api_json
    { id: id, kind: kind, title: title, body: body, url: url, read: read?, created_at: created_at.iso8601 }
  end

  private

  def push_later
    WebPushJob.perform_later(self)
  end
end
