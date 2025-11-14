class TopicSet < ApplicationRecord
has_many :topics, dependent: :destroy
end
