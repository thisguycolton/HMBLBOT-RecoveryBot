# app/controllers/api/highlights_controller.rb
class Api::HighlightsController < ApplicationController
  before_action :authenticate_user!

  def index
    chapter = Chapter.find_by!(slug: params[:chapter_slug])
    render json: current_user.user_highlights.where(chapter_id: chapter.id).select(:id, :selector, :style, :note)
  end

  def create
    chapter = Chapter.find_by!(slug: highlight_params[:chapter_slug])

    hl = current_user.user_highlights.new(
      chapter: chapter,
      selector: highlight_params[:selector],
      style:    highlight_params[:style] || { color: "yellow" },
      note:     highlight_params[:note]
    )

    if hl.save
      render json: { id: hl.id }, status: :created
    else
      render json: { errors: hl.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    hl = current_user.user_highlights.find(params[:id])
    hl.destroy
    head :no_content
  end

  private

  def highlight_params
    params.require(:highlight).permit(
      :chapter_slug, :note,
      style: {},
      selector: {}
    )
  end
end
