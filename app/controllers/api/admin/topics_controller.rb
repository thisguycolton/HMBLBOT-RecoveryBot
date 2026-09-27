# Topics with their ACID QUEST curation: difficulty, tags and per-topic sharing prompts
class Api::Admin::TopicsController < Api::Admin::BaseController
  PER_PAGE = 50

  before_action :set_topic, only: %i[show update destroy save_prompt remove_prompt]

  # GET /api/admin/topics?topic_set_id=&category_id=(id|none)&difficulty=(unset|gentle|standard|deep)
  #                       &tag_id=&prompts=(draft|curated)&q=&page=
  def index
    scope = Topic.all
    scope = scope.where(topic_set_id: params[:topic_set_id]) if params[:topic_set_id].present?
    if params[:category_id] == "none"
      scope = scope.where(topic_category_id: nil)
    elsif params[:category_id].present?
      scope = scope.where(topic_category_id: params[:category_id])
    end
    if params[:difficulty] == "unset"
      scope = scope.where(difficulty: nil)
    elsif Topic::DIFFICULTIES.include?(params[:difficulty])
      scope = scope.where(difficulty: params[:difficulty])
    end
    scope = scope.where(id: TopicTag.where(tag_id: params[:tag_id]).select(:topic_id)) if params[:tag_id].present?
    case params[:prompts]
    when "draft" then scope = scope.where(id: TopicSharingPrompt.where(status: "draft").select(:topic_id))
    when "curated" then scope = scope.where(id: TopicSharingPrompt.select(:topic_id))
    end
    if params[:q].present?
      q = "%#{Topic.sanitize_sql_like(params[:q].strip)}%"
      scope = scope.where("topics.title ILIKE :q OR topics.subtitle ILIKE :q OR topics.searchable_number = :n", q: q, n: params[:q].strip)
    end

    total = scope.count
    page = [params[:page].to_i, 1].max
    topics = scope.order(:topic_set_id, Arel.sql("NULLIF(regexp_replace(searchable_number, '\\D', '', 'g'), '')::int NULLS LAST"), :id)
                  .offset((page - 1) * PER_PAGE).limit(PER_PAGE)
                  .includes(:topic_tags, :topic_sharing_prompts)
    render json: { topics: topics.map { |t| row_json(t) }, total: total, page: page, per_page: PER_PAGE }
  end

  def show
    render json: detail_json(@topic)
  end

  def create
    topic = Topic.new(topic_params)
    Topic.transaction do
      topic.save!
      apply_tags(topic)
    end
    render json: detail_json(topic), status: :created
  rescue ActiveRecord::RecordInvalid
    render_errors(topic)
  end

  def update
    Topic.transaction do
      @topic.update!(topic_params)
      apply_tags(@topic)
    end
    render json: detail_json(@topic.reload)
  rescue ActiveRecord::RecordInvalid
    render_errors(@topic)
  end

  # Topics already in a journey log stay (the log would lose its record)
  def destroy
    if QuestLogEntry.where(topic_id: @topic.id).exists?
      return render json: { errors: ["This topic is part of an ACID QUEST journey log, so it can't be deleted."] }, status: :unprocessable_entity
    end
    @topic.destroy!
    head :no_content
  end

  # PUT /api/admin/topics/:id/prompts/:mode_key { text, status, enabled }
  # Saving from this page is a human edit; approved rows are what the game uses.
  def save_prompt
    mode = SharingMode.find_by!(key: params[:mode_key])
    prompt = @topic.topic_sharing_prompts.find_or_initialize_by(sharing_mode: mode)
    attrs = params.require(:prompt).permit(:text, :status, :enabled)
    prompt.source = "human" if prompt.new_record? || (attrs.key?(:text) && attrs[:text] != prompt.text)
    prompt.assign_attributes(attrs)
    prompt.save ? render(json: detail_json(@topic.reload)) : render_errors(prompt)
  end

  # DELETE /api/admin/topics/:id/prompts/:mode_key - back to the generic prompt
  def remove_prompt
    mode = SharingMode.find_by!(key: params[:mode_key])
    @topic.topic_sharing_prompts.where(sharing_mode: mode).destroy_all
    render json: detail_json(@topic.reload)
  end

  private

  def set_topic
    @topic = Topic.find(params[:id])
  end

  def topic_params
    permitted = params.require(:topic).permit(:title, :subtitle, :searchable_number, :link, :topic_set_id, :topic_category_id, :difficulty)
    permitted[:difficulty] = nil if permitted.key?(:difficulty) && permitted[:difficulty].blank?
    permitted[:topic_category_id] = nil if permitted.key?(:topic_category_id) && permitted[:topic_category_id].blank?
    permitted
  end

  # tag_ids: the full list; new_tags: titles to create (or reuse) and add
  def apply_tags(topic)
    topic_param = params[:topic] || {}
    return unless topic_param.key?(:tag_ids) || topic_param.key?(:new_tags)
    ids = Array(topic_param[:tag_ids]).map(&:to_i)
    Array(topic_param[:new_tags]).map(&:to_s).map(&:strip).reject(&:blank?).each do |title|
      ids << (Tag.where("LOWER(title) = ?", title.downcase).first || Tag.create!(title: title)).id
    end
    topic.tag_ids = ids.uniq
  end

  def row_json(topic)
    prompts = topic.topic_sharing_prompts
    topic.as_json(only: %i[id title subtitle searchable_number topic_set_id topic_category_id difficulty]).merge(
      tag_ids: topic.topic_tags.map(&:tag_id),
      prompts: {
        custom: prompts.count { |p| p.status == "approved" && p.enabled },
        off: prompts.count { |p| p.status == "approved" && !p.enabled },
        draft: prompts.count { |p| p.status == "draft" },
      }
    )
  end

  def detail_json(topic)
    topic.as_json(only: %i[id title subtitle searchable_number link topic_set_id topic_category_id difficulty]).merge(
      tag_ids: topic.tag_ids,
      prompts: topic.topic_sharing_prompts.includes(:sharing_mode).map do |p|
        { mode_key: p.sharing_mode.key, text: p.text, status: p.status, source: p.source, enabled: p.enabled }
      end,
      in_journeys: QuestLogEntry.where(topic_id: topic.id).exists?
    )
  end
end
