class TopicSet < ApplicationRecord
  moderates_language :name, :description
has_many :topics, dependent: :destroy
end
