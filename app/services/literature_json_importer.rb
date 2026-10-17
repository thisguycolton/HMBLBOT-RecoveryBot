# frozen_string_literal: true

# Imports a litconv JSON artifact (schema_version "1.0") into Book / Chapter / Page.
#
# Copy to recoverybot: app/services/literature_json_importer.rb
#
#   LiteratureJsonImporter.import!("out/bigbook-4e.json")                  # first import
#   LiteratureJsonImporter.import!("out/bigbook-4e.json", replace: true)   # re-import
#
# Behaviour
# - One transaction. Any failure rolls everything back.
# - Book is found by (work_key, edition, language) — the unique index — then by slug.
# - Chapters are upserted by slug so chapter ids (and user_highlights rows) survive a
#   re-import. Chapters missing from the file are deleted only with replace: true.
# - Pages are replaced wholesale (nothing references them).
# - Before writing, every chapter is verified: content == plain text of tiptap_json,
#   text_hash == sha256(content), slugs unique, index 0..n-1. The file is rejected
#   otherwise.
# - A warning is returned for every highlighted chapter whose text changed
#   (user_highlights store character offsets).
require "digest"
require "json"

class LiteratureJsonImporter
  SUPPORTED_SCHEMA_VERSIONS = %w[1.0].freeze

  class Error < StandardError; end

  Result = Struct.new(:book, :chapters_created, :chapters_updated, :chapters_deleted, :pages_created, :warnings,
                      keyword_init: true)

  BOOK_FIELDS = %w[title author info pdf_url published_date purchase_link aa_approved org_approved
                   publicly_accessible image_url description slug work_key edition language meta].freeze
  CHAPTER_FIELDS = %w[title number content slug index first_page last_page tiptap_json text_hash kind label].freeze

  def self.import!(source, replace: false, allow_invalid: false)
    data = source.is_a?(Hash) ? source : JSON.parse(File.read(source, encoding: "UTF-8"))
    new(data, replace: replace, allow_invalid: allow_invalid).import!
  end

  def initialize(data, replace:, allow_invalid:)
    @data = data
    @replace = replace
    @allow_invalid = allow_invalid
    @warnings = []
  end

  def import!
    verify!
    ActiveRecord::Base.transaction do
      book = upsert_book
      counts = upsert_chapters(book)
      pages = replace_pages(book)
      Result.new(book: book, pages_created: pages, warnings: @warnings, **counts)
    end
  end

  # --- canonical Tiptap → plain text (mirror of litconv/output/plaintext.py) -----------------
  def self.tiptap_to_plain(doc)
    out = []
    collect_blocks(doc, out)
    out.reject { |s| s.strip.empty? }.join("\n\n")
  end

  def self.collect_blocks(node, out)
    content = node["content"] || []
    case node["type"]
    when "paragraph", "heading"
      out << inline_text(content)
    when "doc", "blockquote"
      content.each { |c| collect_blocks(c, out) }
    when "orderedList", "bulletList"
      start = node.dig("attrs", "start") || 1
      content.each_with_index do |item, k|
        inner = []
        (item["content"] || []).each { |c| collect_blocks(c, inner) }
        inner = inner.reject { |s| s.strip.empty? }
        next if inner.empty?

        prefix = node["type"] == "orderedList" ? "#{start + k}. " : "• "
        out << prefix + inner.join("\n\n")
      end
    end
    # pageBreak, horizontalRule and unknown nodes carry no text
  end

  def self.inline_text(nodes)
    nodes.map do |n|
      case n["type"]
      when "text" then n["text"].to_s
      when "hardBreak" then "\n"
      else ""
      end
    end.join
  end

  private

  def verify!
    version = @data["schema_version"]
    raise Error, "unsupported schema_version #{version.inspect}" unless SUPPORTED_SCHEMA_VERSIONS.include?(version)
    unless @allow_invalid || @data.dig("validation", "valid")
      raise Error, "file failed litconv validation (#{@data.dig('validation', 'error_count')} errors); " \
                   "fix it or pass allow_invalid: true"
    end

    chapters = @data.fetch("chapters")
    indexes = chapters.map { |c| c["index"] }
    raise Error, "chapter index must be 0..#{chapters.size - 1} in order" unless indexes == (0...chapters.size).to_a

    slugs = chapters.map { |c| c["slug"] }
    dup = slugs.find { |s| slugs.count(s) > 1 }
    raise Error, "duplicate chapter slug #{dup.inspect}" if dup

    chapters.each do |c|
      plain = self.class.tiptap_to_plain(c["tiptap_json"])
      raise Error, "chapter #{c['slug']}: content does not match tiptap_json" unless plain == c["content"]
      raise Error, "chapter #{c['slug']}: text_hash mismatch" unless Digest::SHA256.hexdigest(c["content"]) == c["text_hash"]
    end
  end

  def upsert_book
    attrs = @data.fetch("book").slice(*BOOK_FIELDS)
    attrs["published_date"] = attrs["published_date"].presence && Date.parse(attrs["published_date"])
    attrs["meta"] = (attrs["meta"] || {}).merge(
      "litconv" => { "source" => @data["source"], "generator" => @data["generator"] }
    )
    book = Book.find_by(work_key: attrs["work_key"], edition: attrs["edition"], language: attrs["language"]) ||
           Book.find_by(slug: attrs["slug"]) || Book.new
    book.assign_attributes(attrs)
    book.save!
    book
  end

  def upsert_chapters(book)
    existing = Chapter.where(book_id: book.id).index_by(&:slug)
    incoming = @data["chapters"].map { |c| c["slug"] }
    stale = existing.keys - incoming
    if stale.any? && !@replace
      raise Error, "book has chapters not in the file (#{stale.first(5).join(', ')}…); pass replace: true"
    end

    # Park existing rows on negative indexes so the (book_id, index) unique index
    # cannot collide while chapters are reordered.
    Chapter.where(book_id: book.id).update_all('"index" = -1 - "index"') if existing.any?

    created = updated = 0
    @data["chapters"].each do |c|
      rec = existing.delete(c["slug"])
      if rec
        warn_if_highlights_shift(rec, c)
        updated += 1
      else
        rec = Chapter.new(book_id: book.id)
        created += 1
      end
      rec.assign_attributes(c.slice(*CHAPTER_FIELDS))
      rec.save!
    end

    deleted = 0
    existing.each_value do |rec|
      warn_if_highlights_shift(rec, nil)
      rec.destroy!
      deleted += 1
    end
    { chapters_created: created, chapters_updated: updated, chapters_deleted: deleted }
  end

  def warn_if_highlights_shift(rec, incoming)
    return unless rec.respond_to?(:user_highlights)
    return if incoming && rec.text_hash == incoming["text_hash"]

    n = rec.user_highlights.count
    return if n.zero?

    action = incoming ? "text changed" : "chapter removed"
    @warnings << "#{rec.slug}: #{action}; #{n} user highlight(s) may no longer point at the right text"
  end

  def replace_pages(book)
    Page.where(book_id: book.id).delete_all
    @data.fetch("pages").each do |p|
      Page.create!(book_id: book.id, content: p["content"], page_number: p["page_number"])
    end
    @data["pages"].size
  end
end
