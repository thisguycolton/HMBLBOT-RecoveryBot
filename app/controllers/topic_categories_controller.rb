class TopicCategoriesController < ApplicationController
  before_action :set_topic_category, only: %i[ show edit update destroy ]

  # GET /topic_categories or /topic_categories.json
  def index
    @topic_categories = TopicCategory.all
  end

  # GET /topic_categories/1 or /topic_categories/1.json
  def show
  end

  # GET /topic_categories/new
  def new
        @icons = Icon.all
    @topic_category = TopicCategory.new
  end

  # GET /topic_categories/1/edit
  def edit
    @icons = Icon.all
  end

  # POST /topic_categories or /topic_categories.json
  def create
    @topic_category = TopicCategory.new(topic_category_params)

    respond_to do |format|
      if @topic_category.save
        format.html { redirect_to @topic_category, notice: "Topic category was successfully created." }
        format.json { render :show, status: :created, location: @topic_category }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @topic_category.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /topic_categories/1 or /topic_categories/1.json
  def update
    respond_to do |format|
      if @topic_category.update(topic_category_params)
        format.html { redirect_to @topic_category, notice: "Topic category was successfully updated." }
        format.json { render :show, status: :ok, location: @topic_category }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @topic_category.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /topic_categories/1 or /topic_categories/1.json
  def destroy
    @topic_category.destroy!

    respond_to do |format|
      format.html { redirect_to topic_categories_path, status: :see_other, notice: "Topic category was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_topic_category
      @topic_category = TopicCategory.find(params.expect(:id))
    end

    # Only allow a list of trusted parameters through.
    def topic_category_params
      params.expect(topic_category: [ :title, :cat, :icon_id ])
    end
end
