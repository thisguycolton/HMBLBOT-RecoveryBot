# A library book a group has approved for its meetings
class GroupBook < ApplicationRecord
  belongs_to :group
  belongs_to :book

  validates :book_id, uniqueness: { scope: :group_id }
  validates :note, length: { maximum: 200 }
end
