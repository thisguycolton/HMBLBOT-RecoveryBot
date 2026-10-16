# A member of the event's group who can edit it. Only the group's admins add them.
class EventCollaborator < ApplicationRecord
  belongs_to :event
  belongs_to :user
  belongs_to :added_by, class_name: "User", optional: true

  validates :user_id, uniqueness: { scope: :event_id }
  validate :in_the_group

  after_create_commit :tell_them

  private

  def in_the_group
    errors.add(:user, "isn't a member of #{event.group.title}") unless event&.group&.member?(user)
  end

  def tell_them
    return if added_by_id == user_id

    Notification.deliver(user, kind: "event.collaborator", title: "You can edit “#{event.title}” now",
                               body: "#{added_by&.display_name || 'A group admin'} added you as a collaborator.",
                               url: "#{event.path}/edit")
  end
end
