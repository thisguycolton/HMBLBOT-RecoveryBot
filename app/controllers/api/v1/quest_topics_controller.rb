# Topic draws for ACID QUEST. Reads the same Topicificator library (topic sets, categories)
# without touching Api::TopicsController.
class Api::V1::QuestTopicsController < ApplicationController
  MAX_COUNT = 5

  # GET /api/v1/quest_topics/draw?topic_set_id=&category_id=&count=&exclude_ids=1,2
  # (category_id=none draws from topics without a category)
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

    topics = scopes.lazy.map { |scope| pick(scope.where.not(id: exclude), count) }.find(&:any?)
    topics ||= pick(base, count)

    if topics.any?
      render json: topics.map { |t| t.as_json(only: %i[id title subtitle topic_category_id]) }
    else
      render json: { error: "No topics found" }, status: :not_found
    end
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
    scope.order(Arel.sql("RANDOM()")).limit(count).to_a
  end
end
