# The HTML of a group document, as the editor (Tiptap) writes it. Documents are read by
# every member and, when Public, by anyone, so what is stored is cleaned here first: only
# what the editor can make (text, headings, lists, quotes, tables, links, alignment) stays.
module DocumentHtml
  TAGS = %w[p br h1 h2 h3 h4 strong b em i u s strike code pre blockquote ul ol li hr a table thead tbody tfoot tr th td].freeze
  ATTRIBUTES = %w[href colspan rowspan style].freeze
  # Gone with everything inside them, not just unwrapped
  DISCARD = "script, style, svg, math, iframe, object, embed, noscript, template, form, head, title".freeze
  LINK = /\A(https?:|mailto:|\/(?!\/)|#)/i
  SANITIZER = Rails::HTML5::SafeListSanitizer.new

  module_function

  def sanitize(html)
    stripped = Loofah.html5_fragment(html.to_s)
    stripped.css(DISCARD).each(&:remove)
    fragment = Loofah.html5_fragment(SANITIZER.sanitize(stripped.to_html, tags: TAGS, attributes: ATTRIBUTES))
    fragment.css("a").each do |a|
      if a["href"].to_s.strip.match?(LINK)
        a["rel"] = "noopener noreferrer nofollow"
        a["target"] = "_blank"
      else
        a.remove_attribute("href")
      end
    end
    fragment.to_html
  end

  # The words in it, as one line
  def text(html)
    fragment = Loofah.html5_fragment(html.to_s)
    fragment.css(DISCARD).each(&:remove)
    spaced = fragment.to_html.gsub(%r{</(p|h[1-4]|li|tr|td|th|blockquote|pre)>|<br\s*/?>}i, " \\0")
    Loofah.html5_fragment(spaced).text(encode_special_chars: false).gsub(" ", " ").squish
  end
end
