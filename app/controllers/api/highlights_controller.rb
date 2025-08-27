# app/controllers/api/highlights_controller.rb
class Api::HighlightsController < ApplicationController
  before_action :authenticate_user!, except: [:index] # index is public if share token present

  # GET /api/highlights?chapter_slug=... [&share=token]
  def index
    chapter_slug = params.require(:chapter_slug)

    scope =
      if params[:share].present?
        owner = User.find_by!(share_token: params[:share])
        owner.user_highlights
      else
        authenticate_user!
        current_user.user_highlights
      end

    # JOIN chapters and filter by chapters.slug
    rows = scope
      .joins(:chapter)
      .where(chapters: { slug: chapter_slug })
      .order(:id)

    render json: rows.as_json(only: [:id, :style, :selector, :created_at, :updated_at])
  rescue ActiveRecord::RecordNotFound => e
    render json: { error: e.message }, status: :not_found
  end

  # POST /api/highlights
  # { highlight: { chapter_slug, style: {...}, selector: {...} } }
  def create
    authenticate_user!
    ch_slug = highlight_params[:chapter_slug]
    chapter = Chapter.find_by!(slug: ch_slug)

    h = current_user.user_highlights.new(
      chapter:  chapter,
      style:    highlight_params[:style],
      selector: highlight_params[:selector],
      note:     highlight_params[:note]
    )
    h.save!
    render json: { id: h.id }, status: :created
  rescue ActiveRecord::RecordNotFound => e
    render json: { error: e.message }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages }, status: :unprocessable_entity
  end

  # DELETE /api/highlights/:id
  def destroy
    authenticate_user!
    h = current_user.user_highlights.find(params[:id])
    h.destroy!
    head :no_content
  end

  # POST /api/highlights/share -> { share_token: "..." }
  def share
    authenticate_user!
    current_user.update!(share_token: SecureRandom.urlsafe_base64(16)) if current_user.share_token.blank?
    render json: { share_token: current_user.share_token }
  end

  private

  def highlight_params
    params.require(:highlight).permit(:chapter_slug, :note, style: {}, selector: {})
  end
end
