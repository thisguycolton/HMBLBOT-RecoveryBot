class PollsController < ApplicationController
  before_action :set_poll, only: %i[ show edit update destroy ]

  # GET /polls or /polls.json
  def index
    @polls = Poll.all
  end

  # GET /polls/1 or /polls/1.json
  def show
    @options = @poll.options
  end

  # GET /polls/new
  def new
    @poll = Poll.new
    @random_topics = Topic.order("RANDOM()").limit(4)
    @random_topics.each { |topic| @poll.options.build(topic_id: topic.id) }  # Adjust for your database (e.g., MySQL uses RAND(), PostgreSQL uses RANDOM())
  end

  # GET /polls/1/edit
  def edit
  end

  # POST /polls or /polls.json

  def create
    @poll = Poll.new(poll_params)
    puts poll_params.inspect
    if @poll.save
      redirect_to @poll, notice: 'Poll was successfully created.'
    else
      @random_topics = Topic.order("RANDOM()").limit(4)
      render :new
    end
  end

  # PATCH/PUT /polls/1 or /polls/1.json
  def update
    respond_to do |format|
      if @poll.update(poll_params)
        format.html { redirect_to poll_url(@poll), notice: "Poll was successfully updated." }
        format.json { render :show, status: :ok, location: @poll }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @poll.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /polls/1 or /polls/1.json
  def destroy
    @poll.destroy

    respond_to do |format|
      format.html { redirect_to polls_url, notice: "Poll was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_poll
      @poll = Poll.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def poll_params
      params.require(:poll).permit(:closeDate, :closeTime, :description, options_attributes: [:id, :topic_id, :topic_title, :_destroy])
    end
end
