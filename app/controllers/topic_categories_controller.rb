# Topic categories. Browsers go to the React admin (Categories tab); JSON stays - ACID QUEST
# reads /topic_categories.json and the older game reads /topic_categories/:id.
class TopicCategoriesController < ApplicationController
  include TopicificatorAdminPages

  before_action :require_topicificator_admin!, only: %i[new edit create update destroy]
  before_action :set_topic_category, only: %i[show edit update destroy]

  # GET /topic_categories.json
  def index
    @topic_categories = TopicCategory.all
    respond_to do |format|
      format.json
      format.html { redirect_to_admin("categories") }
    end
  end

  # GET /topic_categories/1(.json) - JSON first, so plain fetch() calls get JSON
  def show
    respond_to do |format|
      format.json
      format.html { redirect_to_admin(category_id: @topic_category.id) }
    end
  end

  def new = redirect_to_admin("categories")
  def edit = redirect_to_admin("categories")

  def create
    @topic_category = TopicCategory.new(topic_category_params)
    if @topic_category.save
      render :show, formats: :json, status: :created
    else
      render json: @topic_category.errors, status: :unprocessable_entity
    end
  end

  def update
    if @topic_category.update(topic_category_params)
      render :show, formats: :json
    else
      render json: @topic_category.errors, status: :unprocessable_entity
    end
  end

  # Its topics move to the Open Road (no category)
  def destroy
    TopicCategory.transaction do
      @topic_category.topics.update_all(topic_category_id: nil)
      @topic_category.destroy!
    end
    head :no_content
  end

  private

  def set_topic_category
    @topic_category = TopicCategory.find(params.expect(:id))
  end

  def topic_category_params
    params.expect(topic_category: [:title, :cat, :icon_id, :icon_name])
  end
end
