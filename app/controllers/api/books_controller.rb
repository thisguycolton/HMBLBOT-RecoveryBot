require "digest"

class Api::BooksController < ApplicationController
  before_action :set_book, only: [:show, :update, :export]
  before_action :authenticate_user!, only: [:create, :update, :import_json]
  before_action :require_admin!, only: [:create, :update, :import_json]



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

    unless payload.is_a?(Hash)
      return render json: { error: "Malformed payload. Expected a JSON object." }, status: :unprocessable_entity
    end

    book_attrs = payload["book"].is_a?(Hash) ? payload["book"] : {}
    book_slug = book_attrs["slug"].presence

    return render json: { error: "The import must include a book slug." }, status: :unprocessable_entity if book_slug.blank?

    if payload.dig("document", "pages").is_a?(Array)
      return import_literature_extraction(payload, book_slug)
    end

    unless payload["chapters"].is_a?(Array)
      return render json: {
        error: 'Malformed payload. Expected an exported book ("chapters") or a repaired PDF extraction ("document.pages").'
      }, status: :unprocessable_entity
    end

    imported_chapters = normalize_imported_chapters(payload["chapters"])
    replace_chapters = ActiveModel::Type::Boolean.new.cast(params[:replace_chapters])

    created = 0
    updated = 0

    ActiveRecord::Base.transaction do
      b = Book.find_or_initialize_by(slug: book_slug)
      b.title        = book_attrs["title"].presence || b.title || book_slug.humanize
      b.description  = book_attrs["description"] if book_attrs.key?("description")
      b.author       = book_attrs["author"]      if book_attrs.key?("author")
      b.image_url    = book_attrs["image_url"]   if book_attrs.key?("image_url")
      b.save!

      b.with_lock do
        # Chapter positions are unique within a book.  First move every existing
        # chapter out of the incoming range so an otherwise valid re-import never
        # fails halfway through due to a transient index collision.
        existing_order = b.chapters.order(:index, :id).to_a
        temporary_base = -((existing_order.map { |chapter| chapter.index.to_i.abs }.max || 0) + existing_order.length + 1)

        existing_order.each_with_index do |chapter, i|
          chapter.update_columns(index: temporary_base - i, updated_at: Time.current)
        end

        if replace_chapters
          b.chapters.destroy_all
        end

        imported_chapters.each do |attrs|
          chapter = b.chapters.find_or_initialize_by(slug: attrs[:slug])
          was_new = chapter.new_record?
          chapter.assign_attributes(attrs)
          changed = chapter.changed?
          chapter.save!
          created += 1 if was_new
          updated += 1 if !was_new && changed
        end

        # In non-replace mode, keep chapters that were not in the file after the
        # imported set instead of leaving their temporary negative positions.
        unless replace_chapters
          imported_slugs = imported_chapters.map { |chapter| chapter[:slug] }
          existing_order.reject { |chapter| imported_slugs.include?(chapter.slug) }.each_with_index do |chapter, i|
            chapter.update_columns(
              index: imported_chapters.length + i + 1,
              updated_at: Time.current
            )
          end
        end
      end
    end

    render json: {
      ok: true,
      book: { slug: book_slug, title: Book.find_by!(slug: book_slug).title },
      created: created,
      updated: updated,
      created_chapters: created,
      updated_chapters: updated,
      chapter_count: imported_chapters.length,
      replaced: replace_chapters
    }
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

  def normalize_imported_chapters(chapters)
    normalized = chapters.each_with_index.map do |chapter, i|
      raise ArgumentError, "Chapter #{i + 1} must be an object" unless chapter.is_a?(Hash)

      slug = chapter["slug"].to_s.parameterize.presence || "chapter-#{i + 1}"
      tiptap_json = chapter["tiptap_json"].presence || chapter["tiptap"] || { "type" => "doc", "content" => [] }
      {
        slug: slug,
        title: chapter["title"].presence || "Chapter #{i + 1}",
        # Imports are always made contiguous in file order. This prevents gaps,
        # duplicates, and collisions from malformed/stale exported indexes.
        index: i + 1,
        first_page: chapter["first_page"],
        last_page: chapter["last_page"],
        tiptap_json: tiptap_json,
        text_hash: chapter["text_hash"].presence || Digest::SHA256.hexdigest(tiptap_json.to_json)
      }
    end

    duplicate_slugs = normalized.map { |chapter| chapter[:slug] }.tally.select { |_, count| count > 1 }.keys
    raise ArgumentError, "Duplicate chapter slugs: #{duplicate_slugs.join(', ')}" if duplicate_slugs.any?

    normalized
  end

  def import_literature_extraction(payload, book_slug)
    unless ActiveModel::Type::Boolean.new.cast(params[:replace_chapters])
      return render json: {
        error: "A PDF extraction can only be re-imported with Replace current chapters enabled."
      }, status: :unprocessable_entity
    end

    LiteratureImporter.import!(
      book_slug: book_slug,
      data: payload,
      title: Book.find_by(slug: book_slug)&.title.presence || "Alcoholics Anonymous",
      replace: true
    )

    book = Book.find_by!(slug: book_slug)
    render json: {
      ok: true,
      book: { slug: book.slug, title: book.title },
      created: book.chapters.count,
      updated: 0,
      chapter_count: book.chapters.count,
      replaced: true,
      source_format: "literature_extraction"
    }
  rescue StandardError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end
end
