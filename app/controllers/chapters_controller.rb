class ChaptersController < ApplicationController
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
  end

  private
  def set_book
    @book = Book.find_by!(slug: params[:book_slug] || params[:slug])
  end
end
