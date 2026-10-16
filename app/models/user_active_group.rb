# The group a member's new readings are tagged to by default ("current group")
class UserActiveGroup < ApplicationRecord
  belongs_to :user
  belongs_to :group
end
