class Chapter < ApplicationRecord
  belongs_to :book
  def self.ransackable_attributes(auth_object = nil)
    ["book_id", "content", "created_at", "id", "number", "title", "updated_at"]
  end
end
