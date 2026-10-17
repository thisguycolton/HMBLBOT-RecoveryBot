# Topic draws for ACID QUEST. Reads the same Topicificator library (topic sets, categories)
# without touching Api::TopicsController.
class Api::V1::QuestTopicsController < ApplicationController
  MAX_COUNT = 5

  # GET /api/v1/quest_topics/draw?topic_set_id=&category_id=&count=&exclude_ids=1,2&difficulty=
  # (category_id=none draws from topics without a category; difficulty=gentle|deep is a
  # preference, e.g. deep for the ghost, gentle for a campfire - never a requirement)
  # Random topics from the set (and category, when given), skipping ones this journey has
  # used. Falls back to the whole set, then to allowing repeats, so a draw never comes up empty.
  def draw
    count = params.fetch(:count, 1).to_i.clamp(1, MAX_COUNT)
    exclude = params[:exclude_ids].to_s.split(",").map(&:to_i)

    base = Topic.all
    base = base.where(topic_set_id: params[:topic_set_id]) if params[:topic_set_id].present?
    scopes = []
    # category_id=none is the Open Road: topics that have no category
    if params[:category_id] == "none"
      scopes << base.where(topic_category_id: nil)
    elsif params[:category_id].present?
      scopes << base.where(topic_category_id: params[:category_id])
    end
    scopes << base
    scopes = prefer_difficulty(scopes, params[:difficulty])

    # take from the first scope, topping up from the next ones until there are enough
    topics = []
    scopes.each do |scope|
      break if topics.size >= count
      topics += pick(scope.where.not(id: exclude + topics.map(&:id)), count - topics.size)
    end
    topics = pick(base, count) if topics.empty?

    if topics.any?
      render json: topics.map { |t| topic_json(t) }
    else
      render json: { error: "No topics found" }, status: :not_found
    end
  end

  # GET /api/v1/quest_topics/:id - one topic, as a draw returns it (for revisits)
  def show
    render json: topic_json(Topic.find(params[:id]))
  end

  # GET /api/v1/quest_topics/categories?topic_set_id=
  # Categories that actually have topics in this set, so the map only offers drawable ones
  def categories
    scope = Topic.where.not(topic_category_id: nil)
    scope = scope.where(topic_set_id: params[:topic_set_id]) if params[:topic_set_id].present?
    counts = scope.group(:topic_category_id).count
    render json: counts.map { |id, n| { id: id, topics: n } }
  end

  private

  def pick(scope, count)
    scope.order(Arel.sql("RANDOM()")).limit(count).includes(topic_sharing_prompts: :sharing_mode).to_a
  end

  # Try the preferred difficulty first within each scope. A gentle preference then avoids deep
  # topics before giving up on it; unset difficulty counts as standard.
  def prefer_difficulty(scopes, difficulty)
    return scopes unless Topic::DIFFICULTIES.include?(difficulty) && difficulty != "standard"
    scopes.flat_map do |scope|
      softer = difficulty == "gentle" ? scope.where(difficulty: [nil, "gentle", "standard"]) : nil
      [scope.where(difficulty: difficulty), softer, scope].compact
    end
  end

  # Approved per-topic wording only; drafts never reach the game
  def topic_json(topic)
    topic.as_json(only: %i[id title subtitle topic_category_id difficulty]).merge(
      prompts: topic.topic_sharing_prompts.select { |p| p.status == "approved" }.map(&:as_game_json)
    )
  end
end
