# Someone a person blocked (Block on their notes, chat messages or profile). It only changes
# what the blocker sees: the blocked person's notes, reposts, comments and chat messages are
# hidden from them, they aren't told about anything the blocked person does, and the blocked
# person can't write on their page. Service for a group (hosting, sub requests, minutes,
# business meetings) is left as it is, since that's done on the group's behalf. It also ends
# any sponsorship between them (Sponsorship).
class UserBlock < ApplicationRecord
  belongs_to :blocker, class_name: "User"
  belongs_to :blocked, class_name: "User"

  validates :blocked_id, uniqueness: { scope: :blocker_id }
  validate { errors.add(:base, "You can't block yourself.") if blocker_id == blocked_id }

  after_create_commit { Sponsorship.end_between!(blocker, blocked) }
end
