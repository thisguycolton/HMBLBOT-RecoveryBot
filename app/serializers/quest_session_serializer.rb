class QuestSessionSerializer < ActiveModel::Serializer
  attributes :id, :join_code, :game_state

  def game_state
    object.game_state || {}
  end
end
