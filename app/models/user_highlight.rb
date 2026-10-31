# app/models/user_highlight.rb
class UserHighlight < ApplicationRecord
  moderates_language :note
  # Highlights stay with their reader until they share one to their timeline: then
  # `visibility` (Followers or Members) says who sees it there and `shared_at` dates it in
  # the feed. Setting it back to private takes it off every timeline, theirs included.
  # Share links (?hl=, ?share=) work whatever this says.
  include Visibility

  belongs_to :user
  belongs_to :chapter

  scope :for_chapter_slug, ->(slug) { joins(:chapter).where(chapters: { slug: slug }) }
  scope :on_timeline, -> { where.not(shared_at: nil) }

  before_save do
    if visibility == "private" then self.shared_at = nil
    else self.shared_at ||= Time.current
    end
  end

  def shared? = shared_at.present?


  validates :selector, presence: true
  validates :style, presence: true
  validates :note, length: { maximum: 10_000 }

  # As a profile feed shows it: the quote, its note and where it's from
  def as_feed_json(viewer:)
    {
      kind: "highlight", id: id, created_at: (shared_at || created_at).iso8601, mine: viewer&.id == user_id, author: user.as_person_json,
      quote: selector.dig("quote", "exact"), note: note, color: style["color"], visibility: (visibility if viewer&.id == user_id),
      book_slug: chapter.book.slug, book_title: chapter.book.title, chapter_slug: chapter.slug, chapter_title: chapter.title,
      share_id: signed_id(purpose: :share),
    }
  end
end
