class Api::TopicsController < ApplicationController
  def by_number
    topic_set_id = params[:topic_set_id].to_i
    number       = params[:number].to_i

    topic = Topic.find_by(topic_set_id: topic_set_id, searchable_number: number)

    if topic
      render json: topic
    else
      render json: { error: "Topic not found in this set" }, status: :not_found
    end
  end

  # GET /api/topics/random?topic_set_id=3
  def random
    scope = Topic.all
    scope = scope.where(topic_set_id: params[:topic_set_id]) if params[:topic_set_id].present?
    topic = scope.order(Arel.sql('RANDOM()')).first

    if topic
      render json: topic
    else
      render json: { error: "No topics found" }, status: :not_found
    end
  end

  def show
    topic = Topic.find_by(id: params[:id])
    if topic
      render json: topic.as_json(only: [:id, :title, :subtitle])
    else
      render json: { error: "Topic not found" }, status: :not_found
    end
  end
end
