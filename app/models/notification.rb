# Something for one account to see in the notification center (the bell in the nav).
# Create them with Notification.deliver; the nav polls Api::NotificationsController.
class Notification < ApplicationRecord
  belongs_to :user

  validates :kind, :title, presence: true

  scope :unread, -> { where(read_at: nil) }
  scope :recent, -> { order(created_at: :desc, id: :desc) }

  # Notification.deliver(users, kind: "text_report.created", title: "...", body: "...", url: "/...")
  def self.deliver(users, kind:, title:, body: nil, url: nil)
    Array(users).uniq.each { |user| create!(user: user, kind: kind, title: title, body: body&.truncate(300), url: url) }
  end

  def read? = read_at.present?

  def as_api_json
    { id: id, kind: kind, title: title, body: body, url: url, read: read?, created_at: created_at.iso8601 }
  end
end
