# Someone asking to be invited to the iPhone app's TestFlight beta, from /testflight
# (TestflightRequestsController). Site admins work through them in Site Admin > TestFlight
# requests: copy the emails into App Store Connect, then mark them invited and done.
class TestflightRequest < ApplicationRecord
  moderates_language :name, :note
  STATUSES = %w[new invited done].freeze
  MAX_NOTE = 1_000

  belongs_to :user, optional: true
  belongs_to :handled_by, class_name: "User", optional: true

  normalizes :email, with: ->(email) { email.strip.downcase }
  normalizes :name, with: ->(name) { name.strip }

  validates :name, presence: true, length: { maximum: 100 }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 254 }
  validates :note, length: { maximum: MAX_NOTE }
  validates :status, inclusion: { in: STATUSES }

  scope :waiting, -> { where(status: "new") }

  after_create_commit :notify_admins

  # Asked already and not finished: a second ask just says thanks again
  def self.pending_for(email)
    where(email: email.to_s.strip.downcase, status: %w[new invited]).first
  end

  def mark!(new_status, by)
    update!(
      status: new_status,
      invited_at: new_status == "new" ? nil : (invited_at || Time.current),
      handled_by: new_status == "new" ? nil : by,
    )
  end

  def as_admin_json
    {
      id: id, status: status, name: name, email: email, note: note,
      created_at: created_at.iso8601, invited_at: invited_at&.iso8601,
      handled_by: handled_by && (handled_by.name.presence || handled_by.email),
      account: user && { name: user.name, username: user.username },
    }
  end

  private

  def notify_admins
    Notification.deliver(User.suite_admins, kind: "testflight.requested", title: "#{name} asked to try the iPhone app",
                                            body: note.presence || email, url: "/admin_panel/testflight_requests")
  end
end
