class ReadingTag < ApplicationRecord
  belongs_to :reading
  belongs_to :tag

  validates :tag_id, uniqueness: { scope: :reading_id }
end
