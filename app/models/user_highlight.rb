# app/models/user_highlight.rb
class UserHighlight < ApplicationRecord
  # Who sees it in its owner's profile feed; new ones take the owner's
  # default_highlight_visibility (Api::HighlightsController#create). Share links (?hl=, ?share=) work whatever this says.
  include Visibility

  belongs_to :user
  belongs_to :chapter

  scope :for_chapter_slug, ->(slug) { joins(:chapter).where(chapters: { slug: slug }) }


  validates :selector, presence: true
  validates :style, presence: true
  validates :note, length: { maximum: 10_000 }

  # As a profile feed shows it: the quote, its note and where it's from
  def as_feed_json(viewer:)
    {
      kind: "highlight", id: id, created_at: created_at.iso8601, mine: viewer&.id == user_id, author: user.as_person_json,
      quote: selector.dig("quote", "exact"), note: note, color: style["color"], visibility: (visibility if viewer&.id == user_id),
      book_slug: chapter.book.slug, book_title: chapter.book.title, chapter_slug: chapter.slug, chapter_title: chapter.title,
      share_id: signed_id(purpose: :share),
    }
  end
end
