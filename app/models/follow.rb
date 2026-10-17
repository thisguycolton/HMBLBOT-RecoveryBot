# One person following another: they see what the other shares with followers, on that
# person's profile (/people/:username). No approval needed; the followed person is told.
class Follow < ApplicationRecord
  belongs_to :follower, class_name: "User"
  belongs_to :followed, class_name: "User"

  validates :followed_id, uniqueness: { scope: :follower_id }
  validate { errors.add(:followed, "can't be yourself") if follower_id == followed_id }
end
