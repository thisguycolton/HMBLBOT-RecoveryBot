class Api::TopicsController < ApplicationController
def random
  if params[:topic_set_id].present?
    topics = Topic.where(topic_set_id: params[:topic_set_id])
  else
    topics = Topic.where(topic_set_id: 1)
  end

  render json: topics.sample
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
