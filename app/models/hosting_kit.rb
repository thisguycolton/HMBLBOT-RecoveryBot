# What a group gives the hosts of a meeting in the Hosting Command Center: the script (one of its
# format documents, cut into sections at its headings), the chat postings to paste into Zoom, and
# readings to share on screen. A kit with no meeting is the group's default, used by every meeting
# without its own; a meeting's kit covers all the days it runs (Meeting#series).
class HostingKit < ApplicationRecord
  MAX_READINGS = 30
  # The service a host lines people up for, as Host Helper had it; the script names them as
  # {{ service_hiw }}, the host and co-host come from the schedule
  DEFAULT_SERVICE_ROLES = [
    { "key" => "host", "label" => "Host" }, { "key" => "co_host", "label" => "Co-host" },
    { "key" => "hiw", "label" => "How It Works" }, { "key" => "traditions", "label" => "The 12 Traditions" },
    { "key" => "timer", "label" => "Timer" }, { "key" => "closing", "label" => "Closing reading" },
  ].freeze
  MAX_ROLES = 20

  belongs_to :group
  belongs_to :meeting, optional: true
  belongs_to :script_document, class_name: "GroupDocument", optional: true
  has_many :postings, -> { order(:minute, :position, :id) }, class_name: "HostChatPosting", dependent: :destroy, inverse_of: :hosting_kit

  before_validation :tidy_readings
  before_validation :tidy_service_roles
  before_validation :tidy_allowed_values
  before_validation { self.activity_anchor = activity_anchor.to_s.squish.first(500).presence }

  validates :meeting_id, uniqueness: true, allow_nil: true
  validate { errors.add(:meeting, "isn't one of this group's") if meeting && meeting.group_id != group_id }
  validate { errors.add(:script_document, "isn't one of this group's") if script_document && script_document.group_id != group_id }
  validate { errors.add(:readings, "can't be more than #{MAX_READINGS}") if readings.size > MAX_READINGS }

  # The kit for a meeting: its own (on any of its days), or else the group's default (or nil)
  def self.for(meeting)
    where(meeting_id: meeting.series.select(:id)).first || find_by(group_id: meeting.group_id, meeting_id: nil)
  end

  def default? = meeting_id.nil?
  def roles = service_roles.presence || DEFAULT_SERVICE_ROLES

  # How many sections a script document makes in the Command Center: its sections (Insert > Add
  # Section in the editor), or else roughly what the page cuts it at, its top headings (h1, else h2,
  # else h3, with two or more). Bold time cues aren't counted here (nil: none of either).
  def self.section_count(document)
    body = document.body.to_s
    return nil if body.blank?

    markers = body.scan(/data-hc-section/).size
    # what comes before the first section is "Before we begin"
    return markers + (ActionController::Base.helpers.strip_tags(body.split(/<div[^>]*data-hc-section/).first).squish.present? ? 1 : 0) if markers.positive?
    return nil if document.body_format == "markdown"

    [1, 2, 3].map { |n| body.scan(/<h#{n}[\s>]/i).size }.find { |count| count >= 2 }
  end

  private

  # [{ key, label }], each key made from its label when it has none ("Closing reading" is
  # closing_reading), unique, at most MAX_ROLES; an empty list means the usual ones
  def tidy_service_roles
    return self.service_roles = nil if service_roles.nil?

    seen = Set.new
    self.service_roles = Array(service_roles).filter_map do |r|
      r = r.to_h.stringify_keys
      label = r["label"].to_s.squish.first(60)
      key = (r["key"].presence || label).to_s.downcase.gsub(/[^a-z0-9]+/, "_").gsub(/\A_+|_+\z/, "").first(40)
      next if label.blank? || key.blank? || !seen.add?(key)

      { "key" => key, "label" => label }
    end.first(MAX_ROLES).presence
  end

  # The dynamic values offered in the document editor, by key ("milestones", "service" for every
  # service role); nil offers them all
  def tidy_allowed_values
    return if allowed_values.nil?

    self.allowed_values = Array(allowed_values).map(&:to_s).select { |k| k.match?(/\A[a-z0-9_]{1,40}\z/) }.uniq.first(40)
  end

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
