# What the apps' Daily Reflection widget shows of a day's reading (Api::WidgetReflectionsController):
# its title ("Overcoming Loneliness", from the chapter's "November 17: Overcoming Loneliness"),
# the quote it opens with, where that's from ("As Bill Sees It, p. 90") and how many minutes
# the whole reading takes at an easy pace.
module WidgetReflection
  WORDS_A_MINUTE = 200
  QUOTE_MAX = 520

  module_function

  def of(chapter)
    quote = nil
    source = nil
    words = 0
    paragraphs(chapter.tiptap_json).each do |node, text|
      words += text.split.size
      role = node.dig("attrs", "role")
      quote ||= text if role == "intro"
      source ||= text if role == "signature"
    end
    if quote.nil?
      # A reading set without roles: the first plain paragraph
      first = paragraphs(chapter.tiptap_json).find { |node, text| node["type"] == "paragraph" && text.present? }
      quote = first&.last
    end
    {
      title: title(chapter),
      quote: quote.to_s.squish.truncate(QUOTE_MAX, separator: " ", omission: "…"),
      source: tidy_source(source),
      minutes: [1, (words / WORDS_A_MINUTE.to_f).round].max,
    }
  end

  def title(chapter)
    raw = chapter.title.to_s.split(":", 2).last.to_s.strip
    raw = chapter.title.to_s if raw.empty?
    # The book sets its titles in capitals; the widget reads better in title case
    raw == raw.upcase ? raw.downcase.titleize : raw
  end

  # "AS BILL SEES IT, p. 90" -> "As Bill Sees It, p. 90"
  def tidy_source(source)
    return "" if source.blank?

    source.squish.gsub(/[[:alpha:]][[:alpha:]']+/) { |w| w == w.upcase && w.length > 1 ? w.capitalize : w }
  end

  # Each block of the reading with its plain text
  def paragraphs(doc)
    list = []
    (doc.is_a?(Hash) ? doc["content"] : nil).to_a.each do |node|
      list << [node, plain(node).squish]
    end
    list
  end

  def plain(node)
    return node["text"].to_s if node["type"] == "text"
    return "\n" if node["type"] == "hardBreak"

    node["content"].to_a.map { |n| plain(n) }.join
  end
end
