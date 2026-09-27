class QuestSessionSerializer < ActiveModel::Serializer
  attributes :id, :join_code, :game_state, :created_at, :updated_at, :topic_set_id, :status, :completed_at, :name

  def game_state
    object.game_state || {}
  end
end
