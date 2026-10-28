# How a group's or a meeting's chips looked from a moment on (ChipDesign, resolved with its art).
# Minted chips never change: a Meeting Maker chip is drawn as its meeting's chips looked on the
# day it was earned (ChipDesign.for_meeting_on). Written whenever a design changes (record),
# with the look before the first change dated back to the start, so older chips keep it.
class ChipDesignVersion < ApplicationRecord
  OWNERS = %w[Group Meeting].freeze
  BEGINNING = Time.utc(2000, 1, 1)

  validates :owner_type, inclusion: { in: OWNERS }

  # Keeps `design` for `owner` from now on; `before` is how it looked until now
  def self.record(owner, design, before:)
    scope = where(owner_type: owner.class.name, owner_id: owner.id)
    create!(owner_type: owner.class.name, owner_id: owner.id, design: before, created_at: BEGINNING) unless scope.exists?
    create!(owner_type: owner.class.name, owner_id: owner.id, design: design, created_at: Time.current)
  end

  # How `owner`'s chips looked at the end of `date`, or nil when they never changed
  def self.on(owner, date)
    where(owner_type: owner.class.name, owner_id: owner.id, created_at: ..date.end_of_day).order(created_at: :desc, id: :desc).pick(:design)
  end
end
