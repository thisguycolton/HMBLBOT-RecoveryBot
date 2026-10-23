# What changed between two copies of a group document, counted the way its version history
# shows it: words added and removed, and the sections (the headings above the changed text)
# they were in. The page draws the full word-by-word diff itself (lib/documentDiff.js, which
# matches blocks and words the same way); this is only the summary kept with each version.
module DocumentDiff
  BLOCKS = %w[p h1 h2 h3 h4 li tr pre summary].freeze
  HEADINGS = %w[h1 h2 h3 h4].freeze
  # Past this many pairs to compare, a changed stretch counts as all removed and all added
  PAIRS_MAX = 250_000

  module_function

  # stats(old_body, new_body, old_format, new_format) -> { words_added:, words_removed:, sections: [] }
  def stats(old_body, new_body, old_format = "html", new_format = "html")
    old_blocks = blocks(old_body, old_format)
    new_blocks = blocks(new_body, new_format)
    added = removed = 0
    sections = []
    each_change(old_blocks, new_blocks) do |olds, news|
      a, r = word_changes(olds.flat_map { |b| words(b[:text]) }, news.flat_map { |b| words(b[:text]) })
      next if a.zero? && r.zero?

      added += a
      removed += r
      (news.presence || olds).each { |b| sections << (HEADINGS.include?(b[:tag]) ? b[:text] : b[:section]) }
    end
    { words_added: added, words_removed: removed, sections: sections.compact.uniq.first(6) }
  end

  # The document as a list of { tag:, text:, section: } (the heading it sits under)
  def blocks(body, format = "html")
    return markdown_blocks(body) if format == "markdown"

    fragment = Loofah.html5_fragment(body.to_s)
    fragment.css("br").each { |br| br.replace(" ") }
    section = nil
    list = []
    fragment.css(BLOCKS.join(",")).each do |node|
      next if node.ancestors.any? { |a| BLOCKS.include?(a.name) } # a li's own p is the li, a cell's is its row

      text = (node.name == "tr" ? node.css("th,td").map(&:text).join(" | ") : node.text).gsub(" ", " ").squish
      next if text.empty?

      section = text if HEADINGS.include?(node.name)
      list << { tag: node.name, text: text, section: section }
    end
    # Text with no paragraphs around it (a document saved before the editor) is one block
    loose = list.empty? && fragment.text.squish
    loose.present? ? [{ tag: "p", text: loose, section: nil }] : list
  end

  def markdown_blocks(body)
    section = nil
    body.to_s.split(/\n\s*\n|\n(?=\s*(?:#|[-*+] |\d+\. ))/).filter_map do |chunk|
      text = chunk.squish
      next if text.empty?

      heading = text.match(/\A#+\s+(.*)/)
      section = heading[1] if heading
      { tag: heading ? "h2" : "p", text: heading ? heading[1] : text, section: section }
    end
  end

  def words(text) = text.split

  # Yields each stretch of blocks that differ: (old blocks, new blocks)
  def each_change(olds, news)
    pairs = lcs(olds.map { |b| b[:text] }, news.map { |b| b[:text] })
    i = j = 0
    (pairs + [[olds.size, news.size]]).each do |oi, nj|
      yield olds[i...oi], news[j...nj] if oi > i || nj > j
      i = oi + 1
      j = nj + 1
    end
  end

  # [added, removed] word counts between two word lists
  def word_changes(a, b)
    kept = lcs(a, b).size
    [b.size - kept, a.size - kept]
  end

  # The longest common subsequence of two lists, as [[index in a, index in b], ...]
  def lcs(a, b)
    start = 0
    start += 1 while start < a.size && start < b.size && a[start] == b[start]
    finish = 0
    finish += 1 while finish < a.size - start && finish < b.size - start && a[a.size - 1 - finish] == b[b.size - 1 - finish]
    mid_a = a[start...(a.size - finish)]
    mid_b = b[start...(b.size - finish)]

    middle = []
    unless mid_a.empty? || mid_b.empty? || mid_a.size * mid_b.size > PAIRS_MAX
      lengths = Array.new(mid_a.size + 1) { Array.new(mid_b.size + 1, 0) }
      (mid_a.size - 1).downto(0) do |x|
        (mid_b.size - 1).downto(0) do |y|
          lengths[x][y] = mid_a[x] == mid_b[y] ? lengths[x + 1][y + 1] + 1 : [lengths[x + 1][y], lengths[x][y + 1]].max
        end
      end
      x = y = 0
      while x < mid_a.size && y < mid_b.size
        if mid_a[x] == mid_b[y]
          middle << [start + x, start + y]
          x += 1
          y += 1
        elsif lengths[x + 1][y] >= lengths[x][y + 1]
          x += 1
        else
          y += 1
        end
      end
    end

    (0...start).map { |k| [k, k] } + middle + (0...finish).reverse_each.map { |k| [a.size - 1 - k, b.size - 1 - k] }
  end
end
