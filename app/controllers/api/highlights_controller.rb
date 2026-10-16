# app/controllers/api/highlights_controller.rb
#
# Highlights belong to a reader. They can be shared two ways:
#   * every highlight a reader has made, with the reader's share_token
#     (?share=TOKEN, or the collection page /library/highlights/TOKEN);
#   * one highlight on its own, with that highlight's signed share id
#     (?hl=SHARE_ID), which reveals nothing else.
class Api::HighlightsController < ApplicationController
  include KeepsRobotsOut
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
      note:     highlight_params[:note]
    )
    h.save!
    render json: highlight_json(h), status: :created
  rescue ActiveRecord::RecordNotFound => e
    render json: { error: e.message }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  # PATCH /api/highlights/:id  { highlight: { note: "markdown", style: { color } } }
  # Only the reader who made the highlight can change its note or color.
  # Everyone a highlight is shared with sees the note read-only.
  def update
    h = current_user.user_highlights.find(params[:id])
    attrs = params.require(:highlight).permit(:note, style: {})
    h.note  = attrs[:note].to_s.strip.presence if attrs.key?(:note)
    h.style = attrs[:style] if attrs[:style].present?
    h.save!
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

  # POST /api/highlights/share -> { share_token: "..." }
  def share
    current_user.update!(share_token: SecureRandom.urlsafe_base64(16)) if current_user.share_token.blank?
    render json: { share_token: current_user.share_token }
  end

  private

  def highlight_json(h)
    json = h.as_json(only: [:id, :style, :selector, :note, :created_at, :updated_at])
    mine = current_user.present? && h.user_id == current_user.id
    json["mine"] = mine
    if mine
      # Only the owner gets the per-highlight share id.
      json["share_id"] = h.signed_id(purpose: :share)
    else
      # First name only: enough to say whose highlight this is.
      json["by"] = h.user.name.to_s.split.first.presence
    end
    json
  end

  def highlight_params
    params.require(:highlight).permit(:chapter_slug, :book_slug, :note, style: {}, selector: {})
  end
end
