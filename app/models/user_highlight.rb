# app/models/user_highlight.rb
class UserHighlight < ApplicationRecord
  belongs_to :user
  belongs_to :chapter

  validates :selector, presence: true
  validates :style, presence: true
end
