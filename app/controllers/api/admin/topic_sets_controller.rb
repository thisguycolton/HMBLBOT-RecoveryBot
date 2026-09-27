class Api::Admin::TopicSetsController < Api::Admin::BaseController
  before_action :set_topic_set, only: %i[update destroy]

  def create
    set = TopicSet.new(topic_set_params)
    set.save ? render(json: set, status: :created) : render_errors(set)
  end

  def update
    @topic_set.update(topic_set_params) ? render(json: @topic_set) : render_errors(@topic_set)
  end

  # A set can't go while journeys still use it (or its topics are in a journey log)
  def destroy
    journeys = QuestSession.where(topic_set_id: @topic_set.id).count
    logged = QuestLogEntry.joins(:topic).where(topics: { topic_set_id: @topic_set.id }).count
    if journeys.positive? || logged.positive?
      return render json: { errors: ["#{@topic_set.name} is used by ACID QUEST journeys, so it can't be deleted."] }, status: :unprocessable_entity
    end
    @topic_set.destroy!
    head :no_content
  end

  private

  def set_topic_set
    @topic_set = TopicSet.find(params[:id])
  end

  def topic_set_params
    params.require(:topic_set).permit(:name, :description)
  end
end
