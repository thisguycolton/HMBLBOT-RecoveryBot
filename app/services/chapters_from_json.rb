# app/services/imports/chapters_from_json.rb
module Imports
  class ChaptersFromJson
    class ImportError < StandardError; end

    Result = Struct.new(:book, :created, :updated, keyword_init: true)

    def self.call(...) = new(...).call

    def initialize(json:, book_id: nil)
      @json    = json
      @book_id = book_id
      @created = 0
      @updated = 0
    end

    def call
      @book = resolve_book!
      chapters = Array(@json["chapters"])
      raise ImportError, "No chapters array" if chapters.empty?

      chapters.each { |ch| upsert_chapter!(ch) }

      Result.new(book: @book, created: @created, updated: @updated)
    end

    private

    def resolve_book!
      return Book.find(@book_id) if @book_id.present?

      meta = @json["book"] || {}
      title = meta["title"].presence or raise ImportError, "book.title required (or pass book_id)"
      slug  = meta["slug"].presence || title.parameterize

      Book.find_or_create_by!(slug: slug) do |b|
        b.title = title
      end
    end

    def upsert_chapter!(ch)
      title = ch["title"].to_s.strip
      slug  = (ch["slug"].presence || title.parameterize)
      raise ImportError, "chapter missing title" if title.blank?

      # Adjust for your schema/column names:
      rec = @book.chapters.find_or_initialize_by(slug: slug)
      rec.title = title

      # Prefer TipTap JSON if provided
      if ch["tiptap"].present?
        rec.tiptap_json = ch["tiptap"]
        rec.tiptap = ch["tiptap"] if rec.respond_to?(:tiptap) # if you store it as jsonb/text too
      end

      # Optionally store raw text (if you keep it)
      if ch["text"].present? && rec.respond_to?(:raw_text)
        rec.raw_text = ch["text"]
      end

      if rec.new_record?
        rec.save!
        @created += 1
      else
        changes = {}
        changes[:title] = title if rec.will_save_change_to_attribute?(:title)
        # tiptap_json/text will already be tracked by ActiveRecord
        rec.save!
        @updated += 1
      end
    end
  end
end
