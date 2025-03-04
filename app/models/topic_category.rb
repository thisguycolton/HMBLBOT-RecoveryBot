class TopicCategory < ApplicationRecord
  has_many :topics
  belongs_to :icon, optional: true
end
