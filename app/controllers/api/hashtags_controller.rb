# #hashtags in timeline notes (Hashtags). Everything here counts and lists only the notes the
# viewer can see (TimelineNote.seen_by), so a tag used only in someone's private notes never
# shows to anyone else. The note editor suggests tags from `index` as you type #; a tag's
# page (/people/tags/:tag) lists its notes from `show`.
class Api::HashtagsController < ApplicationController
  include GroupScoped

  FEED_MAX = 40

  before_action :require_profiles

  # GET /api/hashtags[?q=grat] -> { hashtags: [{ name, count }] }: the tags starting with q,
  # most used first (with no q, the most used of all)
  def index
    q = params[:q].to_s.strip.delete_prefix("#")
    limit = params[:limit].to_i.clamp(1, 20) if params[:limit].present?
    tags = q.empty? || Hashtags.normalize(q) ? TimelineNote.hashtag_counts(current_user, prefix: q, limit: limit || 8) : []
    render json: { hashtags: tags }
  end

  # GET /api/hashtags/:tag[?before=ISO8601] -> { name, count, feed, more }: its notes, newest
  # first, and what editing your own needs (groups, note_max, images_max)
  def show
    tag = Hashtags.normalize(params[:tag])
    return render(json: { error: "That isn't a hashtag." }, status: :not_found) unless tag

    notes = TimelineNote.seen_by(current_user).tagged(tag)
    page = notes
    page = page.where(created_at: ...before_param) if before_param
    page = page.for_feed.newest_first.limit(FEED_MAX + 1).to_a
    render json: {
      name: tag,
      count: notes.count,
      feed: page.first(FEED_MAX).map { |n| n.as_api_json(viewer: current_user) },
      more: page.size > FEED_MAX,
      groups: current_user.groups.order(:title).map { |g| { slug: g.slug, title: g.title } },
      note_max: TimelineNote::BODY_MAX, images_max: TimelineNote::IMAGES_MAX,
    }
  end

  private

  def require_profiles
    return if User.profiles_open_to?(current_user)

    render json: { error: "Profiles aren't open yet." }, status: :forbidden
  end

  def before_param
    Time.iso8601(params[:before]) if params[:before].present?
  rescue ArgumentError
    nil
  end
end
