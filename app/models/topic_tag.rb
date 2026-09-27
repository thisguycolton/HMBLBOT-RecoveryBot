# A tag on a Topicificator topic (the same Tag vocabulary Readings use)
class TopicTag < ApplicationRecord
  belongs_to :topic
  belongs_to :tag

  validates :tag_id, uniqueness: { scope: :topic_id }
end
