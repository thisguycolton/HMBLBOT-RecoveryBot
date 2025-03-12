# app/controllers/api/v1/quest_inventories_controller.rb
module Api
  module V1
    class QuestInventoriesController < ApplicationController
      before_action :set_quest_session

      def show
        @quest_inventory = @quest_session.quest_inventory
        if @quest_inventory
          render json: @quest_inventory
        else
          render json: { error: 'Inventory not found' }, status: :not_found
        end
      end

      def update
        @quest_inventory = @quest_session.quest_inventory
        if @quest_inventory
          if @quest_inventory.update(quest_inventory_params)
            render json: @quest_inventory
          else
            render json: @quest_inventory.errors, status: :unprocessable_entity
          end
        else
          render json: { error: 'Inventory not found' }, status: :not_found
        end
      end



      private

      def set_quest_session
        @quest_session = QuestSession.find(params[:quest_session_id])
        unless @quest_session
          render json: { error: 'Session not found' }, status: :not_found
        end
      end

      def quest_inventory_params
        params.require(:quest_inventory).permit(:items)
      end
    end
  end
end
