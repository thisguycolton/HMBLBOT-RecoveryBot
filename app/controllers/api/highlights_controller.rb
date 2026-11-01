# app/controllers/api/highlights_controller.rb
#
# Highlights belong to a reader. They can be shared two ways:
#   * every highlight a reader has made, with the reader's share_token
#     (?share=TOKEN, or the collection page /library/highlights/TOKEN);
#   * one highlight on its own, with that highlight's signed share id
#     (?hl=SHARE_ID), which reveals nothing else. Its link preview shows a picture of it
#     (ShareMeta.highlight), and its owner can make pictures of it to post (card).
#
# Others who see a highlight on a timeline can repost it to theirs when it's shared with
# Members (UserHighlight#repostable_by?), and take the repost back. Anyone who sees it on a
# timeline can react to it (Like, Love or Hugs), as with notes.
class Api::HighlightsController < ApplicationController
  include KeepsRobotsOut
  include SendsQuoteCards
  include Reacting
  keep_robots_out
  before_action :authenticate_user!, except: [:index, :collection]

  # GET /api/highlights?chapter_slug=...[&book_slug=...][&share=TOKEN | &hl=SHARE_ID]
  def index
    chapter_slug = params.require(:chapter_slug)

    scope =
      if params[:hl].present?
        highlight = UserHighlight.find_signed(params[:hl], purpose: :share)
        return render json: [] unless highlight
        UserHighlight.where(id: highlight.id)
      elsif params[:share].present?
        User.find_by!(share_token: params[:share]).user_highlights
      elsif current_user
        current_user.user_highlights
      else
        # Public reader, nothing shared -> no highlights (but not a 401)
        return render json: []
      end

    rows = scope.joins(chapter: :book).where(chapters: { slug: chapter_slug })
    rows = rows.where(books: { slug: params[:book_slug] }) if params[:book_slug].present?

    render json: rows.includes(:user).order(:id).map { |h| highlight_json(h) }
  rescue ActiveRecord::RecordNotFound => e
    render json: { error: e.message }, status: :not_found
  end

  # GET /api/highlights/collection[?share=TOKEN]
  # Every highlight of one reader (yourself, or whoever shared the token), across all books.
  def collection
    owner = params[:share].present? ? User.find_by!(share_token: params[:share]) : current_user
    return head :unauthorized unless owner

    mine = owner == current_user
    rows = owner.user_highlights.includes(chapter: :book)
                .sort_by { |h| [h.chapter.book.title.to_s, h.chapter.index.to_i, h.selector.dig("position", "start").to_i] }

    render json: {
      owner: { first_name: owner.name.to_s.split.first.presence, mine: mine },
      share_token: (owner.share_token if mine),
      highlights: rows.map { |h|
        highlight_json(h).merge(
          quote: h.selector.dig("quote", "exact"),
          chapter_slug: h.chapter.slug,
          chapter_title: h.chapter.title,
          book_slug: h.chapter.book.slug,
          book_title: h.chapter.book.title
        )
      }
    }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "That share link isn't valid anymore." }, status: :not_found
  end

  # POST /api/highlights
  # { highlight: { chapter_slug, book_slug, style: {...}, selector: {...} } }
  def create
    chapters = Chapter.where(slug: highlight_params[:chapter_slug])
    chapters = chapters.joins(:book).where(books: { slug: highlight_params[:book_slug] }) if highlight_params[:book_slug].present?
    chapter = chapters.first!

    h = current_user.user_highlights.new(
      chapter:  chapter,
      style:    highlight_params[:style],
      selector: highlight_params[:selector],
      note:     highlight_params[:note],
      # Kept to themselves until they share it to their timeline (UserHighlight)
      visibility: Visibility::LEVELS.include?(highlight_params[:visibility]) ? highlight_params[:visibility] : "private"
    )
    h.save!
    h.mention!(current_user)
    render json: highlight_json(h), status: :created
  rescue ActiveRecord::RecordNotFound => e
    render json: { error: e.message }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  # PATCH /api/highlights/:id  { highlight: { note: "markdown", style: { color }, visibility } }
  # Only the reader who made the highlight can change its note, color or who sees it on their
  # timeline: "followers" or "public" shares it there (Share to timeline), "private" takes it off.
  # Everyone a highlight is shared with sees the note read-only.
  def update
    h = current_user.user_highlights.find(params[:id])
    attrs = params.require(:highlight).permit(:note, :visibility, style: {})
    h.note  = attrs[:note].to_s.strip.presence if attrs.key?(:note)
    h.visibility = attrs[:visibility] if attrs.key?(:visibility)
    h.style = attrs[:style] if attrs[:style].present?
    h.save!
    # Tells who its note newly @ mentions, once it's shared and they can see it (UserHighlight)
    h.mention!(current_user)
    render json: highlight_json(h)
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  # DELETE /api/highlights/:id
  def destroy
    h = current_user.user_highlights.find(params[:id])
    h.destroy!
    head :no_content
  end

  # GET /api/highlights/:id/card.png?look=paper|marker|night|sunrise&size=wide|square|story
  #   &note=0 (leave the note off) &name=1 (put their first name on it) &download=1
  # A picture of your own highlight to post anywhere (QuoteCard). Only yours.
  def card
    h = current_user.user_highlights.find(params[:id])
    picture = QuoteCard.highlight(h, look: params[:look], size: params[:size], note: params[:note] != "0", name: params[:name] == "1")
    send_card(picture)
  end

  # PUT /api/highlights/:id/reaction  kind: like|love|hugs -> the highlight as a feed shows it
  def react
    return unless (@reactable = visible_highlight)

    save_reaction(what: "highlight", url: @reactable.user.profile_path) { render json: feed_json(@reactable) }
  end

  # DELETE /api/highlights/:id/reaction -> the highlight as a feed shows it
  def unreact
    return unless (@reactable = visible_highlight)

    remove_reaction { render json: feed_json(@reactable) }
  end

  # POST /api/highlights/:id/repost  visibility -> the repost, now on your timeline
  def repost
    h = visible_highlight
    return unless h

    repost = current_user.timeline_notes.find_by(repost_of_highlight: h) ||
             current_user.timeline_notes.create!(repost_of_highlight: h, body: "", visibility: repost_visibility)
    if repost.previously_new_record?
      Notification.deliver(h.user, kind: "note.repost", title: "#{current_user.display_name} reposted your highlight",
                                   body: h.quote.truncate(120), url: current_user.profile_path, from: current_user)
    end
    render json: TimelineNote.for_feed.find(repost.id).as_api_json(viewer: current_user), status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  # DELETE /api/highlights/:id/repost -> the highlight as a feed shows it, off your timeline
  def unrepost
    h = visible_highlight
    return unless h

    current_user.timeline_notes.where(repost_of_highlight: h).destroy_all
    render json: feed_json(h)
  end

  # POST /api/highlights/share -> { share_token: "..." }
  def share
    current_user.update!(share_token: SecureRandom.urlsafe_base64(16)) if current_user.share_token.blank?
    render json: { share_token: current_user.share_token }
  end

  private

  def feed_json(h)
    UserHighlight.includes(:reposts, chapter: :book, reactions: { user: { avatar_attachment: :blob } }).find(h.id).as_feed_json(viewer: current_user)
  end

  # The highlight to react to or repost, if they can see it on its owner's timeline (and didn't block them)
  def visible_highlight
    h = UserHighlight.find_by(id: params[:id])
    return h if h&.visible_to?(current_user) && !current_user.blocked_ids.include?(h.user_id)

    render json: { error: "That highlight isn't here anymore." }, status: :not_found
    nil
  end

  # Who sees a new repost: as asked, or your followers unless you share notes with Members by default
  def repost_visibility
    return params[:visibility] if %w[followers public].include?(params[:visibility])

    current_user.default_note_visibility == "public" ? "public" : "followers"
  end

  def highlight_json(h)
    json = h.as_json(only: [:id, :style, :selector, :note, :created_at, :updated_at])
    # Who its @ mentions name, only for people who can see profiles (share links can be opened
    # signed out, and they don't get people's names)
    json["mentions"] = User.profiles_open_to?(current_user) ? h.mentions : {}
    mine = current_user.present? && h.user_id == current_user.id
    json["mine"] = mine
    if mine
      # Only the owner gets the per-highlight share id.
      json["share_id"] = h.signed_id(purpose: :share)
      json["visibility"] = h.visibility
      json["shared_at"] = h.shared_at&.iso8601
      json["profiles"] = User.profiles_open_to?(current_user)
    else
      # First name only: enough to say whose highlight this is.
      json["by"] = h.user.name.to_s.split.first.presence
    end
    json
  end

  def highlight_params
    params.require(:highlight).permit(:chapter_slug, :book_slug, :note, :visibility, style: {}, selector: {})
  end
end
