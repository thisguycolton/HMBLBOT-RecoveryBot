# A comment on a group document, in the margin beside the words it's about, or a reply to one.
# A comment points at its words by quoting them (with a little of the text before and after,
# to tell repeats apart), so it needs no mark in the document itself: readers who can't edit
# can comment, and the page finds the words again after edits. If they're gone, it shows the
# quote. Only top-level comments quote; replies belong to their comment's thread.
class GroupDocumentComment < ApplicationRecord
  BODY_MAX = 4_000
  QUOTE_MAX = 1_000
  CONTEXT_MAX = 64

  belongs_to :group_document
  belongs_to :user, optional: true
  belongs_to :parent, class_name: "GroupDocumentComment", optional: true
  belongs_to :version, class_name: "GroupDocumentVersion", optional: true
  belongs_to :resolved_by, class_name: "User", optional: true
  has_many :replies, -> { order(:created_at, :id) }, class_name: "GroupDocumentComment", foreign_key: :parent_id, inverse_of: :parent

  before_validation { self.body = body.to_s.strip }
  before_validation do
    self.quote = quote.to_s.strip.first(QUOTE_MAX).presence
    self.prefix = prefix.to_s.last(CONTEXT_MAX).presence
    self.suffix = suffix.to_s.first(CONTEXT_MAX).presence
  end

  validates :body, presence: true, length: { maximum: BODY_MAX }
  validate :reply_stays_in_its_document

  scope :threads, -> { where(parent_id: nil) }

  def resolved? = resolved_at.present?

  def as_api_json(viewer: nil, can_moderate: false)
    json = { id: id, body: body, user: user&.as_person_json, created_at: created_at.iso8601,
             mine: viewer.present? && user_id == viewer.id, can_delete: viewer.present? && (user_id == viewer.id || can_moderate) }
    return json if parent_id

    json.merge(quote: quote, prefix: prefix, suffix: suffix, version: version&.number, resolved: resolved?, resolved_by: resolved_by&.display_name,
               replies: replies.map { |r| r.as_api_json(viewer: viewer, can_moderate: can_moderate) })
  end

  private

  def reply_stays_in_its_document
    return unless parent

    errors.add(:parent, "must be a comment on this document") unless parent.group_document_id == group_document_id && parent.parent_id.nil?
  end
end
