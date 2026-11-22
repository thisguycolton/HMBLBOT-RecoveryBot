# #hashtags in timeline notes and highlight notes (Hashtags). Everything here counts and lists
# only the notes the viewer can see (TimelineNote.seen_by) and the highlights shared to a
# timeline they can see (UserHighlight.seen_by), so a tag used only in someone's private notes
# or highlights never shows to anyone else. The note editor suggests tags from `index` as you type #; a tag's
# page (/people/tags/:tag) lists its notes from `show`.
class Api::HashtagsController < ApplicationController
  include GroupScoped

  before_action :require_profiles

  # GET /api/hashtags[?q=grat] -> { hashtags: [{ name, count }] }: the tags starting with q,
  # most used first (with no q, the most used of all)
  def index
    q = params[:q].to_s.strip.delete_prefix("#")
    limit = params[:limit].to_i.clamp(1, 20) if params[:limit].present?
    tags = q.empty? || Hashtags.normalize(q) ? TimelineNote.hashtag_counts(current_user, prefix: q, limit: limit || 8) : []
    render json: { hashtags: tags }
  end

  # GET /api/hashtags/:tag[?cursor=...] -> { name, count, feed, next, more }: a page of its notes,
  # newest first (FeedPage; `next` is the cursor for the page after it, `more` whether there is
  # one), and what editing your own needs (groups, note_max, images_max)
  def show
    tag = Hashtags.normalize(params[:tag])
    return render(json: { error: "That isn't a hashtag." }, status: :not_found) unless tag

    notes = TimelineNote.seen_by(current_user).tagged(tag)
    highlights = UserHighlight.seen_by(current_user).tagged(tag)
    page = FeedPage.new(viewer: current_user, notes: notes, highlights: highlights, cursor: cursor_param).call
    render json: {
      name: tag,
      count: notes.count + highlights.count,
      feed: page[:items],
      next: page[:next],
      more: page[:next].present?,
      groups: current_user.groups.order(:title).map { |g| { slug: g.slug, title: g.title } },
      note_max: TimelineNote::BODY_MAX, images_max: TimelineNote::IMAGES_MAX,
    }
  end

  private

  def require_profiles
    return if User.profiles_open_to?(current_user)

    render json: { error: "Profiles aren't open yet." }, status: :forbidden
  end

  # A FeedPage cursor; `before` (an ISO 8601 time) is what older pages of the app sent
  def cursor_param
    (params[:cursor].presence || params[:before].presence)&.to_s
  end
end
