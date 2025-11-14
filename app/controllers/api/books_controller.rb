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

    def import_json
    payload = params[:payload]

    # Handle stringified JSON sent from file uploader
    if payload.is_a?(String)
      begin
        payload = JSON.parse(payload)
      rescue JSON::ParserError => e
        return render json: { error: "Invalid JSON: #{e.message}" }, status: :unprocessable_entity
      end
    end

    unless payload.is_a?(Hash) && payload["book"].is_a?(Hash) && payload["chapters"].is_a?(Array)
      return render json: { error: "Malformed payload. Expecting { book: {}, chapters: [] }" }, status: :unprocessable_entity
    end

    created = 0
    updated = 0

    ActiveRecord::Base.transaction do
      b = Book.find_or_initialize_by(slug: payload["book"]["slug"].presence || SecureRandom.hex(6))
      b.title        = payload["book"]["title"].presence || b.title
      b.description  = payload["book"]["description"] if payload["book"].key?("description")
      b.author       = payload["book"]["author"]      if payload["book"].key?("author")
      b.image_url    = payload["book"]["image_url"]   if payload["book"].key?("image_url")
      b.save!

      payload["chapters"].each_with_index do |ch_hash, i|
        slug        = ch_hash["slug"].presence || "chapter-#{i + 1}"
        title       = ch_hash["title"].presence || "Chapter #{i + 1}"
        index       = ch_hash["index"].presence || (i + 1)
        first_page  = ch_hash["first_page"]
        last_page   = ch_hash["last_page"]
        tiptap_json = ch_hash["tiptap_json"].presence || ch_hash["tiptap"] || { "type" => "doc", "content" => [] }

        chapter = b.chapters.find_or_initialize_by(slug: slug)
        chapter.title       = title
        chapter.index       = index
        chapter.first_page  = first_page
        chapter.last_page   = last_page
        chapter.tiptap_json = tiptap_json

        if chapter.new_record?
          chapter.save!
          created += 1
        else
          changed = chapter.changed?
          chapter.save!
          updated += 1 if changed
        end
      end
    end

    render json: { ok: true, created:, updated: }
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages }, status: :unprocessable_entity
  rescue => e
    render json: { error: e.message }, status: :internal_server_error
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
