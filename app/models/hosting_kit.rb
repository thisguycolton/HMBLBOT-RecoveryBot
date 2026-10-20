# What a group gives the hosts of a meeting in the Hosting Command Center: the script (one of its
# format documents, cut into sections at its headings), the chat postings to paste into Zoom, and
# readings to share on screen. A kit with no meeting is the group's default, used by every meeting
# without its own; a meeting's kit covers all the days it runs (Meeting#series).
class HostingKit < ApplicationRecord
  MAX_READINGS = 30

  belongs_to :group
  belongs_to :meeting, optional: true
  belongs_to :script_document, class_name: "GroupDocument", optional: true
  has_many :postings, -> { order(:minute, :position, :id) }, class_name: "HostChatPosting", dependent: :destroy, inverse_of: :hosting_kit

  before_validation :tidy_readings

  validates :meeting_id, uniqueness: true, allow_nil: true
  validate { errors.add(:meeting, "isn't one of this group's") if meeting && meeting.group_id != group_id }
  validate { errors.add(:script_document, "isn't one of this group's") if script_document && script_document.group_id != group_id }
  validate { errors.add(:readings, "can't be more than #{MAX_READINGS}") if readings.size > MAX_READINGS }

  # The kit for a meeting: its own (on any of its days), or else the group's default (or nil)
  def self.for(meeting)
    where(meeting_id: meeting.series.select(:id)).first || find_by(group_id: meeting.group_id, meeting_id: nil)
  end

  def default? = meeting_id.nil?

  private

  # A reading is a chapter of a library book, or a link: { book_slug, chapter_slug, title } or { url, title }
  def tidy_readings
    self.readings = Array(readings).filter_map do |r|
      r = r.to_h.stringify_keys
      title = r["title"].to_s.squish.first(120)
      if r["book_slug"].present? && r["chapter_slug"].present?
        { "book_slug" => r["book_slug"].to_s.first(200), "chapter_slug" => r["chapter_slug"].to_s.first(200), "title" => title.presence || r["chapter_slug"].to_s,
          "book_title" => r["book_title"].to_s.squish.first(160).presence }.compact
      elsif r["url"].to_s.strip.match?(%r{\Ahttps?://}i)
        { "url" => r["url"].to_s.strip.first(1000), "title" => title.presence || r["url"].to_s.strip.first(120) }
      end
    end
  end
end
