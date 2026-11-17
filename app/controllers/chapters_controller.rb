class ChaptersController < ApplicationController
  include KeepsRobotsOut
  keep_robots_out
  layout "reader"
    before_action :set_book


  def show
    @chapter = @book.chapters.find_by!(slug: params[:slug])
  end

  def index
    @chapters = @book.chapters
  end

  def edit
    @chapter = @book.chapters.find_by!(slug: params[:slug])
    redirect_to book_chapter_path(@book.slug, @chapter.slug) unless current_user&.admin?
  end

  private
  # Hidden books are for admins; a members-only book only for its readers (Book#readable_by?),
  # who'd otherwise get its chapters here as JSON. Anyone else goes to the book's page, which
  # says how to get access.
  def set_book
    @book = Book.find_by!(slug: params[:book_slug] || params[:slug])
    raise ActiveRecord::RecordNotFound unless @book.visible_to?(current_user)
    return if @book.readable_by?(current_user)

    respond_to do |format|
      format.json { render json: MembersOnly.json(@book, current_user), status: :forbidden }
      format.any { redirect_to "/library/#{@book.slug}" }
    end
  end
end
