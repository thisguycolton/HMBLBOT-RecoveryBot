class Reading < ApplicationRecord
  moderates_language :title, :host, :meetingName, :content, :topic
  has_rich_text :content
  has_richer_text :richer_content, store_as: :json
  has_rich_text :topic
  belongs_to :user, optional: true
  belongs_to :group, optional: true
  # The reading this one was adopted from (its words and topics were copied to start it)
  belongs_to :adopted_from, class_name: "Reading", optional: true
  has_many :adoptions, class_name: "Reading", foreign_key: :adopted_from_id, inverse_of: :adopted_from, dependent: :nullify
  has_many :reading_tags, dependent: :destroy
  has_many :tags, -> { order(:title) }, through: :reading_tags
  # Polls shown with it (Poll#subject); a poll outlives the reading
  has_many :polls, -> { order(:created_at) }, as: :subject, dependent: :nullify
  # Members' shares on it (ReadingShare), which its poster approves; `shares_off` turns them off
  has_many :shares, class_name: "ReadingShare", dependent: :delete_all

  # Publishing scopes
  # Visibility is computed from published_at at query time, so a scheduled reading
  # goes live on its own once its time passes; no background job is needed.
  # published_at semantics:
  #   nil = draft (not published)
  #   <= Time.current = published
  #   > Time.current = scheduled (not yet published)
  scope :published, -> { where.not(published_at: nil).where("readings.published_at <= ?", Time.current) }
  scope :drafts, -> { where(published_at: nil) }
  scope :scheduled, -> { where("readings.published_at > ?", Time.current) }
  scope :not_published, -> { where(published_at: nil).or(where("readings.published_at > ?", Time.current)) }
  scope :draft, -> { where(published_at: nil) }
  # What someone may look up: published readings, plus their own drafts and scheduled ones
  # (admins can open others' drafts, but these stay out of lists so a draft isn't spread around)
  scope :listable_for, ->(user) { user ? published.or(where(user_id: user.id)) : published }
  scope :published_now, -> { where("readings.published_at <= ?", Time.current) }
  
  def self.ransackable_attributes(auth_object = nil)
    ["title"]
  end
  def self.ransackable_associations(auth_object = nil)
    ["richer_content", "content", "tags"]
  end
  ransacker :richer_content_body do |parent|
    Arel.sql("(SELECT body FROM action_text_rich_texts WHERE action_text_rich_texts.record_type = 'Reading' AND action_text_rich_texts.record_id = readings.id AND action_text_rich_texts.name = 'richer_content')")
  end
  attr_accessor :hour, :minute, :meridiem

  def visible_to?(user)
    published? || user&.admin? || (user && user_id == user.id)
  end

  def published?
    # A reading is published if published_at is set and in the past (or exactly at current time)
    published_at.present? && published_at <= Time.current
  end

  def scheduled_for_later?
    # A reading has a future publish time set
    published_at.present? && published_at > Time.current
  end

  def draft?
    # A reading with no publish time set is a draft
    published_at.blank?
  end

  def toggle_published!
    if published?
      unpublish!
    else
      publish!
    end
  end

  def publish!
    update!(published_at: Time.current)
  end

  def unpublish!
    update!(published_at: nil)
  end

  def schedule_publish!(at_time)
    # Set a future publish time; the reading goes live once that time passes
    update!(published_at: at_time)
  end

  def cancel_schedule!
    # Remove a future publish time
    unpublish!
  end

  # The reading's words as plain text (from the newer editor's JSON, or the older rich text)
  # (an untouched newer editor saves an empty doc, so its words win only when there are some)
  def plain_text
    newer = richer_text_richer_content&.to_plain_text.to_s
    newer.strip.present? ? newer : content.to_plain_text.to_s
  end

  # Its opening, ending on a whole word with "…" when it goes on (the link preview's card)
  def summary(length = 260)
    text = plain_text.squish
    text.size <= length ? text : "#{text.first(length - 1).sub(/\s+\S*\z/, '')}…"
  end

  # AA Grapevine stories ------------------------------------------------------------------
  # Grapevine owns its stories' copyright, so a reading taken from one credits it and links to it
  # (source_url, filled by `bin/rails grapevine:link_sources`), and its full text is public only
  # for a while around the meeting that last used it. Outside that window, people who aren't in
  # the reading's group see its title, a short excerpt and the Read on Grapevine link. Its author,
  # admins, and the group's members and hosts always see the whole reading.
  # This keeps the text out of public view most of the time; it isn't permission to post it.
  GRAPEVINE_PUBLIC_WINDOW = ENV.fetch("GRAPEVINE_PUBLIC_HOURS", 48).to_i.hours
  # The public window opens this long before the meeting, so a reading posted the day before can be read ahead
  GRAPEVINE_OPENS_BEFORE = 24.hours
  GRAPEVINE_HOST = /(\A|\.)aagrapevine\.org\z/i
  GRAPEVINE_SEARCH_URL = "https://www.aagrapevine.org/site-search?keys="
  EXCERPT_LENGTH = 280

  validates :source_url, length: { maximum: 500 }, format: { with: %r{\Ahttps?://\S+\z}, message: "must be a web link" }, allow_blank: true

  def self.grapevine_search_url(title) = "#{GRAPEVINE_SEARCH_URL}#{ERB::Util.url_encode(title.to_s.squish)}"

  def source_host = (URI.parse(source_url.to_s).host rescue nil)

  # Taken from Grapevine: its source link is on aagrapevine.org, or its source line names it
  def grapevine?
    source_host.to_s.match?(GRAPEVINE_HOST) || source.to_s.match?(/grape\s*vine/i)
  end

  # Its link points at a Grapevine search rather than the story itself (the title couldn't be matched)
  def grapevine_search_link? = grapevine? && source_url.to_s.include?("/site-search")

  # When its meeting started: the reading's date and time in its group's time zone
  def meeting_at
    return unless meetingDate

    zone = group&.zone || Time.zone
    start = meetingDate.in_time_zone(zone)
    meetingTime ? start + meetingTime.hour.hours + meetingTime.min.minutes : start
  end

  # The last time a meeting used it: its own meeting, or a later one whose host picked it
  def last_used_on = [last_used_at, meeting_at].compact.max

  # A meeting is using it now (a host picked it for the day): remember when
  def mark_used!(at = Time.current)
    update_column(:last_used_at, at) if last_used_at.nil? || at > last_used_at
  end

  # The time its full text stops being public (nil: it isn't time-limited, or was never used)
  def public_text_until
    used = last_used_on
    used && used + GRAPEVINE_PUBLIC_WINDOW
  end

  # Whether anyone at all may read the whole thing right now
  def public_text_open?(now = Time.current)
    return true unless grapevine?

    used = last_used_on
    !!used && now >= used - GRAPEVINE_OPENS_BEFORE && now <= used + GRAPEVINE_PUBLIC_WINDOW
  end

  # Whether this person sees the whole reading (else the excerpt and the Grapevine link)
  def full_text_for?(user, now = Time.current)
    return true if public_text_open?(now)
    return false unless user
    return true if user.admin? || user_id == user.id

    !!group && (group.member?(user) || group.can_host?(user))
  end

  def excerpt(length = EXCERPT_LENGTH) = summary(length)

  after_validation :parse_time

  def parse_time
    if hour.present? && minute.present? && meridiem.present?
      self.meetingTime = DateTime.parse("#{hour}:#{minute}#{meridiem}")
    end
  end
end
