# lib/tasks/books.rake
require "json"

namespace :books do
  desc "Export a book (by slug) to JSON file. Usage: rails books:export[slug,output_path]"
  task :export, [:slug, :out] => :environment do |_, args|
    abort "Usage: rails books:export[slug,out.json]" unless args[:slug].present?

    out = args[:out].presence || "#{args[:slug]}-export-#{Time.now.strftime('%Y%m%d-%H%M%S')}.json"

    book = Book.find_by!(slug: args[:slug])
    payload = {
      version: 1,
      exported_at: Time.current.iso8601,
      book: { slug: book.slug, title: book.title },
      chapters: book.chapters.order(:index).map { |c|
        {
          slug:        c.slug,
          title:       c.title,
          index:       c.index,
          first_page:  c.first_page,
          last_page:   c.last_page,
          tiptap_json: c.tiptap_json.presence || { "type" => "doc", "content" => [] }
        }
      }
    }

    File.write(out, JSON.pretty_generate(payload))
    puts "Exported #{book.title} (#{book.slug}) -> #{out}"
  end

  desc "Import a book JSON (upsert by book.slug + chapter.slug). Usage: rails books:import[path]"
  task :import, [:path] => :environment do |_, args|
    abort "Usage: rails books:import[path/to/export.json]" unless args[:path].present?
    payload = JSON.parse(File.read(args[:path])) rescue abort("Could not parse JSON at #{args[:path]}")

    book_attrs = payload.fetch("book") { abort "Missing 'book' key" }
    chapters   = payload.fetch("chapters") { abort "Missing 'chapters' key" }

    Book.transaction do
      book = Book.find_or_initialize_by(slug: book_attrs.fetch("slug"))
      book.title = book_attrs["title"].presence || book.title.presence || "Untitled Book"
      book.save!

      chapters.each do |row|
        ch = book.chapters.find_or_initialize_by(slug: row.fetch("slug"))
        ch.title       = row["title"]
        ch.index       = row["index"]
        ch.first_page  = row["first_page"]
        ch.last_page   = row["last_page"]
        ch.tiptap_json = row["tiptap_json"].presence || { "type" => "doc", "content" => [] }
        ch.save!
      end

      # compact 1..N indexes
      ids = book.chapters.order(:index, :id).pluck(:id)
      ids.each_with_index { |id, i| Chapter.where(id: id).update_all(index: i + 1) }
    end

    puts "Imported book: #{book_attrs["title"]} (#{book_attrs["slug"]}), chapters: #{chapters.size}"
  end
end
