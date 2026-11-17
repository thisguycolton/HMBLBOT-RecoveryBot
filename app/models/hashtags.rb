# #hashtags in a note's Markdown: a # right after a space or the start of a line (so not in a
# link's #anchor or "&#39;"), then a letter and up to 49 more letters, digits or _. "#1" isn't
# one, and "# Heading" is a heading. Code (`#this`) doesn't count. Tags are kept in
# lowercase, so #Gratitude and #gratitude are the same tag. book/Markdown.jsx finds them the
# same way to show them as links.
module Hashtags
  PATTERN = /(?<![\p{L}\p{N}_&#\/])#(\p{L}[\p{L}\p{N}_]{0,49})(?![\p{L}\p{N}_])/
  NAME = /\A\p{L}[\p{L}\p{N}_]{0,49}\z/

  # The tags in `markdown`, in lowercase, each once, in the order they first come
  def self.in(markdown)
    text = markdown.to_s.gsub(/^```.*?^```/m, " ").gsub(/`[^`\n]+`/, " ")
    text.scan(PATTERN).map { |(tag)| tag.downcase }.uniq
  end

  # `tag` as it's kept (no #, lowercase), or nil when it can't be one
  def self.normalize(tag)
    tag = tag.to_s.strip.delete_prefix("#").downcase
    tag if NAME.match?(tag)
  end
end
