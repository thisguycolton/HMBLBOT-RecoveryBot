class Page < ApplicationRecord
  belongs_to :book
  serialize :page_number, String
  validates :content, presence: true
end
