# "Tell our tale" for a journey: GET lists its tales (and whether storytelling is available);
# POST { style } writes a new one. Opt-in only; nothing is generated unless asked.
class Api::V1::QuestStoriesController < ApplicationController
  before_action :set_quest_session

  def index
    render json: {
      enabled: QuestStoryGenerator.enabled?,
      styles: QuestStoryGenerator::STYLES.map { |key, s| { key: key, name: s[:name] } },
      remaining: [QuestStoryGenerator::MAX_PER_JOURNEY - @quest_session.quest_stories.count, 0].max,
      stories: @quest_session.quest_stories.order(:created_at),
    }
  end

  def create
    return render json: { error: "The storyteller isn't set up on this server." }, status: :service_unavailable unless QuestStoryGenerator.enabled?

    story = QuestStoryGenerator.new(@quest_session).generate(params.require(:style).to_s)
    render json: story, status: :created
  rescue ArgumentError
    render json: { error: "Unknown story style." }, status: :unprocessable_entity
  rescue QuestStoryGenerator::LimitReached => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue LlmClient::RateLimited => e
    message = e.daily ? "The storyteller has told all the tales it can today. Try again tomorrow." : "The storyteller needs a rest. Try again in a minute."
    render json: { error: message }, status: :too_many_requests
  rescue LlmClient::Error => e
    Rails.logger.warn("[quest story] #{e.class}: #{e.message}")
    render json: { error: "The storyteller couldn't finish this one. Try again." }, status: :bad_gateway
  end

  private

  def set_quest_session
    @quest_session = QuestSession.find(params[:quest_session_id])
  end
end
