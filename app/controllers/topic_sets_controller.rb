class TopicSetsController < ApplicationController
  before_action :set_topic_set, only: %i[ show edit update destroy ]

  # GET /topic_sets or /topic_sets.json
  def index
    @topic_sets = TopicSet.all
  end

  # GET /topic_sets/1 or /topic_sets/1.json
  def show
  end

  # GET /topic_sets/new
  def new
    @topic_set = TopicSet.new
  end

  # GET /topic_sets/1/edit
  def edit
  end

  # POST /topic_sets or /topic_sets.json
  def create
    @topic_set = TopicSet.new(topic_set_params)

    respond_to do |format|
      if @topic_set.save
        format.html { redirect_to @topic_set, notice: "Topic set was successfully created." }
        format.json { render :show, status: :created, location: @topic_set }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @topic_set.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /topic_sets/1 or /topic_sets/1.json
  def update
    respond_to do |format|
      if @topic_set.update(topic_set_params)
        format.html { redirect_to @topic_set, notice: "Topic set was successfully updated." }
        format.json { render :show, status: :ok, location: @topic_set }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @topic_set.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /topic_sets/1 or /topic_sets/1.json
  def destroy
    @topic_set.destroy!

    respond_to do |format|
      format.html { redirect_to topic_sets_path, status: :see_other, notice: "Topic set was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_topic_set
      @topic_set = TopicSet.find(params.expect(:id))
    end

    # Only allow a list of trusted parameters through.
    def topic_set_params
      params.expect(topic_set: [ :name, :description ])
    end
end
