class TopicSetSerializer < ActiveModel::Serializer
  attributes :id, :name, :description, :topics_count

    def topics_count
    # assuming TopicSet has_many :topics
      object.topics.count
    end
end
