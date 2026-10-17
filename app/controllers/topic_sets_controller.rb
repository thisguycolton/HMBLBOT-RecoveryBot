# Topic sets. Browsers go to the React admin (Topic sets tab); JSON stays for other callers.
class TopicSetsController < ApplicationController
  include TopicificatorAdminPages

  before_action :require_topicificator_admin!, only: %i[new edit create update destroy]
  before_action :set_topic_set, only: %i[show edit update destroy]

  # GET /topic_sets.json
  def index
    @topic_sets = TopicSet.all
    respond_to do |format|
      format.json
      format.html { redirect_to_admin("sets") }
    end
  end

  # GET /topic_sets/1.json
  def show
    respond_to do |format|
      format.json
      format.html { redirect_to_admin(topic_set_id: @topic_set.id) }
    end
  end

  def new = redirect_to_admin("sets")
  def edit = redirect_to_admin("sets")

  def create
    @topic_set = TopicSet.new(topic_set_params)
    if @topic_set.save
      render :show, formats: :json, status: :created
    else
      render json: @topic_set.errors, status: :unprocessable_entity
    end
  end

  def update
    if @topic_set.update(topic_set_params)
      render :show, formats: :json
    else
      render json: @topic_set.errors, status: :unprocessable_entity
    end
  end

  def destroy
    @topic_set.destroy!
    head :no_content
  end

  private

  def set_topic_set
    @topic_set = TopicSet.find(params.expect(:id))
  end

  def topic_set_params
    params.expect(topic_set: [:name, :description])
  end
end
