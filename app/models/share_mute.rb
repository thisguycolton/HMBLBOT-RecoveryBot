# Someone muted another member's shares on readings (ReadingShare): their shares, named or
# anonymous, are left out of what the muter sees. It's made from a share, so the muter never
# learns who an anonymous share's writer was, and the list of mutes never names anyone; the
# Shares section only offers to unmute them all.
class ShareMute < ApplicationRecord
  belongs_to :user
  belongs_to :muted_user, class_name: "User"

  validates :muted_user_id, uniqueness: { scope: :user_id }
  validate { errors.add(:base, "You can't mute yourself.") if user_id == muted_user_id }
end
