class Api::V1::QuestSessionsController < ApplicationController
  before_action :set_quest_player, only: [:index, :create]
  before_action :set_quest_session, only: [:show, :update, :destroy]

  def index
    @quest_sessions = @quest_player.quest_sessions
    render json: @quest_sessions
  end

  def show
    quest_session = QuestSession.find(params[:id])
    render json: quest_session, serializer: QuestSessionSerializer
  end

  def create
    @quest_session = @quest_player.quest_sessions.new
    @quest_session.join_code = generate_join_code

    # Get the game state from the request parameters
    game_state_params = params[:game_state] || {}

    # Set the game state
    @quest_session.game_state = {
      grid: game_state_params[:grid] || {},
      current_position: game_state_params[:current_position] || { x: 0, y: 0 },
      points: game_state_params[:points] || 5,
      inventory: game_state_params[:inventory] || {}
    }

    if @quest_session.save
      render json: @quest_session, status: :created
    else
      render json: { errors: @quest_session.errors }, status: :unprocessable_entity
    end
  end

  def destroy
    if @quest_session.destroy
      render json: { message: 'Session deleted successfully' }, status: :ok
    else
      render json: { errors: @quest_session.errors }, status: :unprocessable_entity
    end
  end

  def update
    quest_session = QuestSession.find(params[:id])
    game_state = params[:game_state]

    if quest_session.update(game_state: game_state)
      render json: quest_session, serializer: QuestSessionSerializer, status: :ok
    else
      render json: { errors: quest_session.errors }, status: :unprocessable_entity
    end
  end


private

def quest_session_params
  params.require(:quest_session).permit(
    :join_code,
    game_state: {}
  ).tap do |params|
    params[:game_state] = params[:game_state].to_h
  end
end

  def set_quest_player
    @quest_player = QuestPlayer.find(params[:quest_player_id])
  end

  def set_quest_session
    @quest_session = QuestSession.find(params[:id])
  end

  def generate_join_code
    chars = ('A'..'Z').to_a + ('0'..'9').to_a
    join_code = chars.sample(4).join

    while QuestSession.exists?(join_code: join_code)
      join_code = chars.sample(4).join
    end

    join_code
  end
end
