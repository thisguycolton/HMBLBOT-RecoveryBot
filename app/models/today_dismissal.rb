# A "Needs your attention" item a member cleared from Today (see TodayDuties#json). It stays
# cleared while the item's title is the same; a changed item shows again.
class TodayDismissal < ApplicationRecord
  KEEP = 90.days # older ones are for items long gone

  belongs_to :user

  validates :key, :title, presence: true

  # Clear the item for them (again, if its title changed since)
  def self.clear!(user, key:, title:)
    where(user: user).where(updated_at: ...KEEP.ago).delete_all
    row = find_or_initialize_by(user: user, key: key)
    row.update!(title: title.to_s.truncate(255))
    row
  end
end
