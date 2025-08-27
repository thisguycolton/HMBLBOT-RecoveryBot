class Api::BooksController < ApplicationController
  before_action :set_book, only: [:show, :export]
  def show
    book = Book.find_by!(slug: params[:slug])
    render json: { id: book.id, slug: book.slug, title: book.title }
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
end
