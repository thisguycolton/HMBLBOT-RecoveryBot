# Someone a group's admins blocked: taken out of the group, and kept from asking to join again
# or coming back by its invite link until an admin unblocks them
class GroupBlock < ApplicationRecord
  belongs_to :group
  belongs_to :user
  belongs_to :blocked_by, class_name: "User", optional: true

  validates :user_id, uniqueness: { scope: :group_id }
end
