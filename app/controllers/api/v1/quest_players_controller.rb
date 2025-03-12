# app/controllers/api/v1/quest_players_controller.rb
module Api
  module V1
    class QuestPlayersController < ApplicationController
      before_action :set_quest_player, only: [:show, :update, :destroy]

      def index
        @quest_players = QuestPlayer.all
        render json: @quest_players
      end

      def show
        render json: @quest_player
      end

      def create
        # Check if player exists by screen_name
        @quest_player = QuestPlayer.find_by(screen_name: quest_player_params[:screen_name])

        if @quest_player
          render json: @quest_player, status: :ok
        else
          # Create a new player if not found
          @quest_player = QuestPlayer.new(quest_player_params)
          if @quest_player.save
            render json: @quest_player, status: :created
          else
            render json: @quest_player.errors, status: :unprocessable_entity
          end
        end
      end

      def update
        if @quest_player.update(quest_player_params)
          render json: @quest_player
        else
          render json: @quest_player.errors, status: :unprocessable_entity
        end
      end

      def destroy
        @quest_player.destroy
        render json: { message: 'QuestPlayer deleted successfully' }
      end

        def create_by_screen_name
    existing_player = QuestPlayer.find_by(screen_name: quest_player_params[:screen_name])
    if existing_player
      render json: existing_player, status: :ok
      return
    end

    player = QuestPlayer.new(quest_player_params)
    if player.save
      render json: player, status: :created
    else
      render json: { errors: player.errors }, status: :unprocessable_entity
    end
  end

      private

      def set_quest_player
        # Search for player by screen_name
        @quest_player = QuestPlayer.find_by(screen_name: params[:screen_name])
        unless @quest_player
          render json: { error: 'Player not found' }, status: :not_found
        end
      end

      def quest_player_params
        params.require(:quest_player).permit(:screen_name)
      end
    end
  end
end
