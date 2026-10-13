# frozen_string_literal: true

# Fixes the few things litconv gets wrong in its Twelve Steps and Twelve Traditions output,
# then rewrites content/text_hash so LiteratureJsonImporter still verifies the file.
#
#   bin/rails runner script/repair_twelve_twelve.rb ../recoverybot_pdf/out/twelve-twelve.json db/imports/twelve-twelve.json
#
# - Each Step/Tradition opens with its statement in italics. litconv puts the statement's
#   last line in a paragraph of its own ("…unmanage-" / "able.”"); the two are joined back
#   into one paragraph, dropping the line-wrap hyphen.
# - Two words litconv kept hyphenated at a line wrap are joined (see WORD_FIXES).
# - The book gets a description and nickname like the Big Book's.
require "digest"
require "json"

input, output = ARGV
abort "usage: script/repair_twelve_twelve.rb IN.json OUT.json" if input.blank? || output.blank?

WORD_FIXES = {
  "Brook-lyn" => "Brooklyn",
  "news-men" => "newsmen"
}.freeze

data = JSON.parse(File.read(input, encoding: "UTF-8"))
abort "not the Twelve and Twelve" unless data.dig("book", "work_key") == "twelve_and_twelve"

data["book"]["description"] ||= "Co-founder Bill W.'s essays on the Twelve Steps, the principles by which " \
                                "A.A. members recover, and the Twelve Traditions, by which the fellowship functions."
data["book"]["meta"] = (data["book"]["meta"] || {}).merge("nickname" => "The Twelve and Twelve")

def node_text(node)
  (node["content"] || []).sum("") { |n| n["text"].to_s }
end

repairs = []

data["chapters"].each do |chapter|
  blocks = chapter["tiptap_json"]["content"]
  intro = blocks.each_index.select { |i| blocks[i]["type"] == "paragraph" && blocks[i].dig("attrs", "role") == "intro" }
  if intro.size == 2 && intro[1] == intro[0] + 1
    first, rest = blocks.values_at(*intro)
    head = node_text(first)
    tail = node_text(rest)
    joined = head.end_with?("-") ? head.chomp("-") + tail : "#{head} #{tail}"
    first["content"] = [{ "type" => "text", "text" => joined, "marks" => first["content"].first["marks"] }.compact]
    blocks.delete_at(intro[1])
    repairs << "#{chapter['slug']}: joined statement"
  elsif intro.size > 2
    abort "#{chapter['slug']}: #{intro.size} intro paragraphs; check it by hand"
  end

  walk = lambda do |node|
    if node["type"] == "text"
      WORD_FIXES.each do |from, to|
        next unless node["text"].include?(from)

        node["text"] = node["text"].gsub(from, to)
        repairs << "#{chapter['slug']}: #{from} → #{to}"
      end
    end
    (node["content"] || []).each { |child| walk.call(child) }
  end
  walk.call(chapter["tiptap_json"])

  chapter["content"] = LiteratureJsonImporter.tiptap_to_plain(chapter["tiptap_json"])
  chapter["text_hash"] = Digest::SHA256.hexdigest(chapter["content"])
end

data["pages"].each do |page|
  WORD_FIXES.each { |from, to| page["content"] = page["content"].gsub(from, to) }
end

data["book"]["meta"]["repairs"] = repairs
File.write(output, JSON.pretty_generate(data) + "\n")
puts repairs
puts "wrote #{output}"
