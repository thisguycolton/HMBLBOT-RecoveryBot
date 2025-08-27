class Api::BooksController < ApplicationController
  before_action :set_book, only: [:show, :update, :export]
  before_action :authenticate_user!, only: [:create, :update]
  before_action :require_admin!, only: [:create, :update]



  def index
    books = Book.includes(:chapters).order(:title)
    render json: books.map { |b|
      {
        slug: b.slug,
        title: b.title,
        description: b.try(:description),
        author: b.try(:author),
        image_url: b.try(:image_url),
        chapter_count: b.chapters.size,
        first_chapter_slug: b.chapters.order(:index, :id).limit(1).pluck(:slug).first
      }
    }
  end
  def show
    book = Book.find_by!(slug: params[:slug])
    render json: { id: book.id, slug: book.slug, title: book.title }
  end

    def create
    book = Book.new(book_params)
    book.save!
    render json: { ok: true, slug: book.slug }, status: :created
  end

  def update
    @book.update!(book_params)
    render json: { ok: true, slug: @book.slug }
  end

    def export
    payload = {
      version: 1,
      exported_at: Time.current.iso8601,
      book: {
        slug:  @book.slug,
        title: @book.title,
      },
      chapters: @book.chapters.order(:index).map { |c|
        {
          id:          c.id,                # for reference only
          slug:        c.slug,
          title:       c.title,
          index:       c.index,
          first_page:  c.first_page,
          last_page:   c.last_page,
          tiptap_json: c.tiptap_json.presence || { "type"=>"doc", "content"=>[] }
        }
      }
    }

    filename = "#{@book.slug}-export-#{Time.current.strftime('%Y%m%d-%H%M%S')}.json"
    send_data(JSON.pretty_generate(payload),
      filename: filename,
      type: "application/json",
      disposition: "attachment")
  end

  private

  def set_book
    @book = Book.find_by!(slug: params[:slug])
  end

  def require_admin!
    head :forbidden unless current_user&.admin?
  end

  def book_params
    params.require(:book).permit(:title, :slug, :description, :image_url, :author, :published_at)
  end
end
