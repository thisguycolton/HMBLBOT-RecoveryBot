# A member's report about someone to the site admins: a chat message, note or comment they
# wrote, or the person themselves. What was written is kept as it was (`quote`), so it can
# still be read if it's deleted. Admins see them in the admin suite (Reports).
class UserReport < ApplicationRecord
  STATUSES = %w[open resolved].freeze
  SUBJECTS = { "chat_message" => "ChatMessage", "timeline_note" => "TimelineNote", "note_comment" => "NoteComment" }.freeze

  belongs_to :reporter, class_name: "User"
  belongs_to :user
  belongs_to :group, optional: true
  belongs_to :resolved_by, class_name: "User", optional: true

  validates :reason, presence: true, length: { maximum: 2000 }
  validates :status, inclusion: { in: STATUSES }

  after_create_commit :notify_admins

  scope :unresolved, -> { where(status: "open") }

  def resolve!(by) = update!(status: "resolved", resolved_at: Time.current, resolved_by: by)
  def reopen! = update!(status: "open", resolved_at: nil, resolved_by: nil)

  private

  def notify_admins
    Notification.deliver(User.suite_admins, kind: "user_report.created", title: "#{reporter.display_name} reported #{user.display_name}",
                                            body: reason, url: "/admin_panel/reports")
  end
end
