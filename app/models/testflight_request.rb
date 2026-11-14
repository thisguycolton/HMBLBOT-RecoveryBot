# Someone asking to test the app before it's in the stores, from /testflight
# (TestflightRequestsController): the iPhone app through Apple's TestFlight (platform "ios") or
# the Android app through Google Play's closed test ("android"). Site admins work through them in
# Site Admin > Tester requests: copy the emails into App Store Connect or the Play Console's
# tester list, then mark them invited and done.
class TestflightRequest < ApplicationRecord
  moderates_language :name, :note
  STATUSES = %w[new invited done].freeze
  PLATFORMS = %w[ios android].freeze
  PLATFORM_NAMES = { "ios" => "iPhone", "android" => "Android" }.freeze
  MAX_NOTE = 1_000

  belongs_to :user, optional: true
  belongs_to :handled_by, class_name: "User", optional: true

  normalizes :email, with: ->(email) { email.strip.downcase }
  normalizes :name, with: ->(name) { name.strip }

  validates :name, presence: true, length: { maximum: 100 }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, length: { maximum: 254 }
  validates :note, length: { maximum: MAX_NOTE }
  validates :status, inclusion: { in: STATUSES }
  validates :platform, inclusion: { in: PLATFORMS }

  scope :waiting, -> { where(status: "new") }

  after_create_commit :notify_admins

  # Asked already for the same app and not finished: a second ask just says thanks again
  def self.pending_for(email, platform)
    where(email: email.to_s.strip.downcase, platform: platform, status: %w[new invited]).first
  end

  def platform_name = PLATFORM_NAMES[platform]

  # Moving a request from new to invited emails the person how to join (TesterMailer). Done
  # doesn't email; Back to new and then invited again sends it again, which is how to resend.
  def mark!(new_status, by)
    send_invite = status == "new" && new_status == "invited" && invited_at.nil?
    update!(
      status: new_status,
      invited_at: new_status == "new" ? nil : (invited_at || Time.current),
      handled_by: new_status == "new" ? nil : by,
    )
    TesterMailer.with(testflight_request: self).invited.deliver_later if send_invite
  end

  def as_admin_json
    {
      id: id, status: status, platform: platform, name: name, email: email, note: note,
      created_at: created_at.iso8601, invited_at: invited_at&.iso8601,
      handled_by: handled_by && (handled_by.name.presence || handled_by.email),
      account: user && { name: user.name, username: user.username },
    }
  end

  private

  def notify_admins
    Notification.deliver(User.suite_admins, kind: "testflight.requested", title: "#{name} asked to try the #{platform_name} app",
                                            body: note.presence || email, url: "/admin_panel/testflight_requests")
  end
end
