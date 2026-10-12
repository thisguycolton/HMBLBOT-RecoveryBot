# app/models/user_highlight.rb
class UserHighlight < ApplicationRecord
  belongs_to :user
  belongs_to :chapter

  scope :for_chapter_slug, ->(slug) { joins(:chapter).where(chapters: { slug: slug }) }


  validates :selector, presence: true
  validates :style, presence: true
  validates :note, length: { maximum: 10_000 }
end
