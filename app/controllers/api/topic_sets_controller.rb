class Api::TopicSetsController < ApplicationController
  def index
    topic_sets = TopicSet.all.select(:id, :name, :description)
    render json: topic_sets
  end
end
