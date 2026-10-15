# Someone tagged on a schedule poll. Collaborators help run it (everything but deleting);
# invitees are just asked to vote. Both hear about it in the app and by email.
class SchedulePollMember < ApplicationRecord
  ROLES = %w[collaborator invitee].freeze

  belongs_to :schedule_poll
  belongs_to :user

  validates :role, inclusion: { in: ROLES }
  validates :user_id, uniqueness: { scope: :schedule_poll_id }

  scope :collaborators, -> { where(role: "collaborator") }

  after_create_commit :tell_them

  def as_api_json
    { user_id: user_id, role: role, name: user.name.presence || user.email.split("@").first, email: user.email }
  end

  private

  def tell_them
    poll = schedule_poll
    return if poll.user_id == user_id
    title = role == "collaborator" ? "You're helping run “#{poll.title}”" : "When works for you? Vote in “#{poll.title}”"
    Notification.deliver(user, kind: "schedule_poll.#{role}", title: title, body: poll.description, url: poll.path)
    SchedulePollMailer.with(member: self).tagged.deliver_later
  end
end
