# app/services/literature_importer.rb
class LiteratureImporter
  require "json"
  require "digest"

  def self.import!(book_slug:, dir:, title: "Alcoholics Anonymous", work_key: "bigbook", edition: "4e", language: "en")
    new(book_slug:, dir:, title:, work_key:, edition:, language:).import!
  end

  def initialize(book_slug:, dir:, title:, work_key:, edition:, language:)
    @dir  = Pathname(dir)
    @book = Book.find_or_initialize_by(slug: book_slug)
    if @book.new_record?
      @book.title    = title
      @book.work_key = work_key
      @book.edition  = edition
      @book.language = language
      @book.save!
    end
  end

  def import!
    manifest = JSON.parse(@dir.join("manifest.json").read)
    manifest.fetch("chapters").each do |entry|
      tiptap = JSON.parse(@dir.join(entry.fetch("file")).read)
      ch = Chapter.find_or_initialize_by(book_id: @book.id, index: entry.fetch("index"))
      ch.slug        = entry.fetch("id")
      ch.title       = entry.fetch("title")
      ch.first_page  = entry["first_page"]
      ch.last_page   = entry["last_page"]
      ch.tiptap_json = tiptap
      ch.text_hash   = Digest::SHA256.hexdigest(tiptap.to_json)
      ch.kind      ||= "chapter"
      ch.save!
    end
    @book.touch
    true
  end
end
