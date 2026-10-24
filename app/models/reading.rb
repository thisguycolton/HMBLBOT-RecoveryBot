class Reading < ApplicationRecord
  has_rich_text :content
  has_richer_text :richer_content, store_as: :json
  has_rich_text :topic
  belongs_to :user, optional: true
  belongs_to :group, optional: true
  has_many :reading_tags, dependent: :destroy
  has_many :tags, -> { order(:title) }, through: :reading_tags

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

  def published?
    # A reading is published if published_at is set and in the past (or exactly at current time)
    published_at.present? && published_at <= Time.current
  end

  # The start of the reading as plain text, ending on a whole word with "…" when it goes on (the
  # share card's sheet of paper). The text is its rich text, else the newer editor's: HTML or Tiptap JSON.
  def share_excerpt(limit = 240)
    text = plain_text.squish
    return text if text.size <= limit

    "#{text.first(limit).sub(/\s+\S*\z/, '')}…"
  end

  def plain_text
    html = content.to_s.presence
    richer = richer_content&.body.to_s.strip
    if html.nil? && richer.start_with?("{")
      doc = (JSON.parse(richer) rescue nil)
      return tiptap_text(doc) if doc
    end
    spaced = (html || richer).to_s.gsub(%r{</(p|div|li|h[1-6]|blockquote)>|<br\s*/?>}i) { "#{$&} " }
    CGI.unescapeHTML(ActionController::Base.helpers.strip_tags(spaced).to_s).tr("\u00a0", " ")
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

  after_validation :parse_time

  def parse_time
    if hour.present? && minute.present? && meridiem.present?
      self.meetingTime = DateTime.parse("#{hour}:#{minute}#{meridiem}")
    end
  end

  private

  # The words in a Tiptap document, a space between blocks
  def tiptap_text(node)
    return node["text"].to_s if node["type"] == "text"

    inner = Array(node["content"]).map { |c| tiptap_text(c) }
    node["type"] == "doc" || node["type"] == "text" ? inner.join(" ") : inner.join + " "
  end
end
