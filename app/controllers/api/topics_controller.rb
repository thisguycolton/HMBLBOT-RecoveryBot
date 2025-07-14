class Api::TopicsController < ApplicationController
  def random
    topic = Topic.all.sample
    render json: topic
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
