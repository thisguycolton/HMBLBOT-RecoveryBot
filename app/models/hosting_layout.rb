# Where a meeting's HostDeck blocks go (DeckArrangement), for one meeting series, or the group's
# default when it has no meeting. A meeting without its own uses the default, and a group without
# one uses the built-in "Host a meeting" template (in the page). Separate from HostingKit so a
# meeting can be laid out its own way and still use the group's script, postings and readings.
class HostingLayout < ApplicationRecord
  belongs_to :group
  belongs_to :meeting, optional: true
  belongs_to :updated_by, class_name: "User", optional: true

  before_validation { self.arrangement = DeckArrangement.normalize(arrangement) || {} }

  validates :meeting_id, uniqueness: true, allow_nil: true
  validate { errors.add(:meeting, "isn't one of this group's") if meeting && meeting.group_id != group_id }
  validate { errors.add(:arrangement, "is empty") if arrangement.blank? }

  def default? = meeting_id.nil?

  # The meeting's own layout (on any of its days), or else the group's default (or nil)
  def self.for(meeting)
    where(meeting_id: meeting.series.select(:id)).first || find_by(group_id: meeting.group_id, meeting_id: nil)
  end
end
