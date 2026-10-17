class TopicCategory < ApplicationRecord
  has_many :topics
  belongs_to :icon, optional: true

  # A Lucide icon name in kebab-case ("party-popper"), as with tags
  validates :icon_name, format: { with: /\A[a-z0-9]+(-[a-z0-9]+)*\z/ }, allow_blank: true
end
