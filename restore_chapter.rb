# bin/rails runner <<'RUBY'
require "json"

BOOK_SLUG   = "the-big-book-of-alcoholics-anonymous"
CHAPTERFILE = "/Users/coltonhagan/Projects/recoverybot_pdf/out/chapters/bigbook-4e-ch18.json"

def normalize_doc(raw)
  doc = raw

  # If it came in as a String, try to parse
  if doc.is_a?(String)
    begin
      doc = JSON.parse(doc)
    rescue JSON::ParserError
      doc = nil
    end
  end

  # If we only got an array of nodes, wrap it as a TipTap doc
  if doc.is_a?(Array)
    doc = { "type" => "doc", "content" => doc }
  end

  # If we got a Hash but no type/content, fix minimally
  if doc.is_a?(Hash)
    doc["type"]    ||= "doc"
    doc["content"] ||= []
  end

  # Final guard: ensure we have the doc shape
  doc.is_a?(Hash) ? doc : { "type" => "doc", "content" => [] }
end

data = JSON.parse(File.read(CHAPTERFILE))

book  = Book.find_by!(slug: BOOK_SLUG)
slug  = data["slug"].presence  || "tmp-chapter"
title = data["title"].presence || "Untitled"

# Find content in any of the usual places
raw_doc = data["tiptap"] || data["tiptap_json"] || data["content"]
doc     = normalize_doc(raw_doc)

# Fallback index if missing
json_index = data["index"]
index      = json_index || (book.chapters.maximum(:index) || 100) + 1

attrs = {
  index:       index,
  title:       title,
  first_page:  data["first_page"],
  last_page:   data["last_page"],
  tiptap_json: doc
}

ch = book.chapters.find_or_initialize_by(slug: slug)
ch.assign_attributes(attrs)
ch.save!

# verify what we saved
saved = ch.reload.tiptap_json || {}
nodes = Array(saved["content"])
puts "Upserted #{book.slug}/#{ch.slug} (id=#{ch.id}, index=#{ch.index})"
puts "Saved nodes: #{nodes.length}"
puts "First node type: #{nodes.first && nodes.first['type']}"
RUBY
