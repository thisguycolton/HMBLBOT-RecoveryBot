class TopicsController < ApplicationController
  include TopicificatorAdminPages

  before_action :require_topicificator_admin!, only: %i[new edit create update destroy]
  before_action :set_topic, only: %i[ show edit update destroy ]

  # GET /topics or /topics.json
  def index
    @all_topics = Topic.all
    @q = Topic.ransack(params[:q])
    @random = rand(1...324)
    unless params[:q].nil?
      @topics = @q.result(distinct: true)
    else
      @topics = Topic.all.sample(4)
    end
    respond_to do |format|
      format.html # renders index.html.erb
      format.json { render json: @topics }
    end
  end

def by_category
  category_id = params[:topic_category_id]
  exclude_ids = params[:exclude_ids]&.split(',')&.map(&:to_i)
  exclude_ids ||= []  # Ensure exclude_ids is an empty array if nil

  # Find topics for the category excluding used ones
  topics = Topic.where(topic_category_id: category_id)
  topics = topics.where.not(id: exclude_ids) unless exclude_ids.empty?

  if topics.any?
    render json: topics.sample
  else
    render json: { error: "No available topics" }, status: :not_found
  end
end


  # GET /topics/1 or /topics/1.json
  def show
  @topic = Topic.find_by(id: params[:id])
  if @topic
    render json: @topic
  else
    render json: { error: "Topic not found" }, status: :not_found
  end
  end

  # The topic forms live in the React admin now
  def new = redirect_to_admin("topics/new")
  def edit = redirect_to_admin("topics/#{@topic.id}")

  # POST /topics.json
  def create
    @topic = Topic.new(topic_params)
    if @topic.save
      render json: @topic, status: :created
    else
      render json: @topic.errors, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /topics/1.json
  def update
    if @topic.update(topic_params)
      render json: @topic
    else
      render json: @topic.errors, status: :unprocessable_entity
    end
  end

  # DELETE /topics/1.json
  def destroy
    @topic.destroy
    head :no_content
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_topic
      @topic = Topic.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def topic_params
      params.require(:topic).permit(:title, :searchable_number, :subtitle, :link, :topic_category_id)
    end
end
