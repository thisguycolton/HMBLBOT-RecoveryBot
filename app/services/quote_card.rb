# A picture of a highlight (its quote, and its note if they like) or of a note, to post
# anywhere: Instagram, a story, a text. Drawn here with ImageMagick, like ShareCard, so
# nothing about it is sent to anyone else. The RecoveryBot mark sits at the bottom.
#
#   look  paper    - cream paper, the quote in a book's serif and the note in handwriting
#         marker   - the quote highlighted line by line in the highlight's own color
#         night    - dark blue, the quote in white with a mark of its color
#         sunrise  - a warm orange-to-pink gradient, the quote big and bold
#   size  wide     - 1200×630, what link previews show
#         square   - 1080×1080, a post
#         story    - 1080×1920, a story
#
# It names nobody unless `by` is given (their first name, when they ask for it): anonymity
# is theirs to give up, not ours. Kept in tmp/share_cards under a key made of everything
# on it, so the same picture is drawn once.
#
# Words too long for one picture at a size people can still read become a moving picture (a
# GIF) that turns its pages: the quote in a few pages at an easy size, the note and where it's
# from on the last. `still: true` always makes one picture, cut where it runs out of room
# (link previews, which show a still, and "Copy picture", since a clipboard takes no GIFs).
#
# Its words keep their paragraphs (a daily reading's date, title, quote, where it's from and
# its body each on their own, with a little room between), and pages turn between paragraphs
# where they can.
class QuoteCard
  VERSION = 6
  LOOKS = %w[paper marker night sunrise].freeze
  SIZES = { "wide" => [1200, 630], "square" => [1080, 1080], "story" => [1080, 1920] }.freeze
  ASSETS = ShareCard::ASSETS
  FONTS = ShareCard::FONTS.merge(
    serif: ASSETS.join("Lora_500MediumItalic.ttf").to_s,
    serif_bold: ASSETS.join("Lora_600SemiBold.ttf").to_s,
    serif_upright: ASSETS.join("Lora_400Regular.ttf").to_s,
    hand: ASSETS.join("Caveat_600SemiBold.ttf").to_s
  )
  QUOTE_MAX = 420      # a still picture's words
  LONG_MAX = 2400      # a moving picture's
  PAGES_MAX = 8
  TOO_TALL = 100_000
  # Below this the words get too small to read on a phone, so they turn pages instead
  READABLE = { "wide" => 32, "square" => 42, "story" => 48 }.freeze
  # How big a moving picture's pages set their words
  PAGE_SIZE = { "wide" => 40, "square" => 52, "story" => 60 }.freeze
  NOTE_MAX = 280
  HIGHLIGHT_COLORS = { "yellow" => "#fef08a", "lime" => "#bef264", "cyan" => "#a5f3fc", "pink" => "#fbcfe8", "orange" => "#fed7aa" }.freeze

  attr_reader :look, :size, :quote, :long, :note, :source, :by, :color, :kind, :still, :video

  # kind: :highlight (a quote, maybe with its note) or :note (their own words)
  # formats: { paragraph => :title, :subhead, :italic, :caps or :body }, how the reading set them
  def initialize(quote:, kind: :highlight, note: nil, source: nil, by: nil, color: nil, look: "paper", size: "wide", still: false, formats: nil, video: false)
    @kind = kind.to_sym
    @look = LOOKS.include?(look.to_s) ? look.to_s : LOOKS.first
    @size = SIZES.key?(size.to_s) ? size.to_s : "wide"
    @still = !!still
    @video = !!video && !@still
    @long = clean(quote).truncate(LONG_MAX, separator: " ", omission: "…")
    @quote = @long.truncate(QUOTE_MAX, separator: " ", omission: "…")
    @note = clean(note).truncate(NOTE_MAX, separator: " ", omission: "…").presence
    @source = clean(source).truncate(90).presence
    @by = clean(by).truncate(40).presence
    @color = HIGHLIGHT_COLORS[color.to_s] || (color.to_s.match?(/\A#\h{6}\z/) ? color.to_s : HIGHLIGHT_COLORS["yellow"])
    @given_formats = (formats || {}).to_h { |words, f| [clean(words), f.to_sym] }.reject { |words, _| words.empty? }
  end

  # A highlight's picture. `note:` false leaves its note out, `name:` true puts their first
  # name on it. A note with blocked words in it (from before the filter) is always left out.
  def self.highlight(h, look: nil, size: nil, note: true, name: false, still: false)
    words = note && h.note.present? && !BlockedLanguage.found?(h.note) ? plain(h.note) : nil
    new(kind: :highlight, quote: h.quote, note: words, source: "#{h.chapter.book.title} · #{h.chapter.title}", formats: formats_for(h),
        by: (h.user.display_name.to_s.split.first if name), color: h.style.is_a?(Hash) ? h.style["color"] : nil, look: look, size: size, still: still)
  end

  # A short line mostly in capitals ("TWELVE STEPS AND TWELVE TRADITIONS, p. 96")
  def self.caps?(words)
    letters = words.scan(/[[:alpha:]]/)
    words.length < 90 && letters.size >= 4 && letters.count { |l| l == l.upcase } >= letters.size * 0.85
  end

  # How the chapter set the highlighted paragraphs: { paragraph => :title (a big heading),
  # :subhead (a small one), :italic, :caps (a short line in capitals) or :body }. Empty when
  # it's all plain paragraphs, which keep the usual quote look. The chapter's words are laid
  # end to end the way the reader does when it saves a highlight (ProseMirror's textBetween
  # with "\n" between blocks and for line breaks), so the highlight's offsets point into them.
  def self.formats_for(h)
    text, blocks, italics = flatten(h.chapter&.tiptap_json)
    return {} if text.nil?

    exact = h.quote
    start = h.selector.dig("position", "start")
    start = text.index(exact) unless start.is_a?(Integer) && text[start, exact.length] == exact
    return {} if start.nil? || exact.empty?

    formats_in(text, blocks, italics, start, start + exact.length)
  end

  # A chapter's words laid end to end like the reader's textBetween, with where each heading
  # or paragraph is ([from, to, :title, :subhead or nil]) and which stretches are italic.
  # nil when there's no document.
  def self.flatten(doc)
    return nil unless doc.is_a?(Hash) && doc["content"].is_a?(Array)

    text = +""
    blocks = [] # [from, to, kind]
    italics = [] # [from, to]
    separated = true
    visit = lambda do |node|
      next unless node.is_a?(Hash)

      if node["type"] == "text"
        t = node["text"].to_s
        italics << [text.length, text.length + t.length] if Array(node["marks"]).any? { |m| m.is_a?(Hash) && m["type"] == "italic" }
        text << t
        separated = false
      elsif %w[hardBreak image horizontalRule].include?(node["type"]) || (!node["content"].is_a?(Array) && !%w[paragraph heading codeBlock].include?(node["type"]))
        text << "\n"
        separated = false
      else
        unless separated
          text << "\n"
          separated = true
        end
        from = text.length
        Array(node["content"]).each { |child| visit.(child) }
        if %w[heading paragraph].include?(node["type"])
          level = node.dig("attrs", "level").to_i
          blocks << [from, text.length, node["type"] == "heading" ? (level <= 2 ? :title : :subhead) : nil]
        end
      end
    end
    doc["content"].each { |n| visit.(n) }
    [text, blocks, italics]
  end

  # How the paragraphs between start and stop were set
  def self.formats_in(text, blocks, italics, start, stop)
    formats = {}
    blocks.each do |from, to, heading|
      a, b = [from, start].max, [to, stop].min
      next if a >= b

      italic = italics.sum { |i, j| [[j, b].min - [i, a].max, 0].max }
      text[a...b].split("\n").each do |line|
        words = line.gsub(/[^[:print:]]/, " ").squeeze(" ").strip
        next if words.empty?

        formats[words] = heading ||
                         if italic > (b - a) * 0.6 then :italic
                         elsif caps?(words) then :caps
                         else :body
                         end
      end
    end
    formats.values.all?(:body) ? {} : formats
  end

  # A whole day's reading (a Daily Reflection): every word of the chapter set the way the
  # book sets it, from the book's name. `video: true` makes it an MP4 whose lines fade in
  # one after another.
  def self.chapter(ch, look: nil, size: nil, still: false, video: false)
    text, blocks, italics = flatten(ch.tiptap_json)
    text = text.to_s.strip
    formats = text.empty? ? {} : formats_in(text, blocks, italics, 0, text.length)
    new(kind: :reading, quote: text, source: ch.book.title, formats: formats, look: look, size: size, still: still, video: video)
  end

  # A note's picture: its words (no pictures, links or chips)
  def self.note(n, look: nil, size: nil, name: false, still: false)
    new(kind: :note, quote: plain(n.body), by: (n.user.display_name.to_s.split.first if name), look: look, size: size, still: still)
  end

  # Markdown as plain words: no **, links show their words, pictures and code fences go
  def self.plain(markdown)
    markdown.to_s
            .gsub(/!\[[^\]]*\]\([^)]*\)/, " ")
            .gsub(/\[([^\]]+)\]\([^)]*\)/, '\1')
            .gsub(/```.*?```/m, " ")
            .gsub(/^\s{0,3}(#+|>+|[-*+]|\d+\.)\s+/, "")
            .gsub(/(\*\*|__|\*|_|~~|`)(?=\S)(.+?)(?<=\S)\1/, '\2')
            .gsub(/\n{2,}/, "\n").strip
  end

  def width = SIZES[size][0]
  def height = SIZES[size][1]

  def key
    Digest::SHA256.hexdigest(["quote", VERSION, kind, look, size, still ? quote : long, still, note, source, by, color, @given_formats, video].to_json).first(32)
  end

  def filename
    words = quote.parameterize.split("-").first(5).join("-").presence || "recoverybot"
    "#{words}-#{size}.#{video ? 'mp4' : (animated? ? 'gif' : 'png')}"
  end

  def content_type = video ? "video/mp4" : (animated? ? "image/gif" : "image/png")

  # A moving picture: words too long for one still (and not asked for one)
  def animated? = !video && page_count > 1

  # How many pages it turns through (1: a still picture)
  def page_count
    @page_count ||= if (drawn = cached)
      drawn.basename.to_s[/-(\d+)\.(gif|mp4)\z/, 1]&.to_i || 1
    else
      pages.size
    end
  end

  # The picture's path (a PNG, or a GIF named with its page count), drawn now if it isn't there yet
  def path
    return cached if cached

    FileUtils.mkdir_p(ShareCard::DIR)
    Dir.mktmpdir("quote-card") do |dir|
      if video
        file = ShareCard::DIR.join("#{key}-#{pages.size}.mp4")
        out = render_video(dir)
      elsif pages.size > 1
        file = ShareCard::DIR.join("#{key}-#{pages.size}.gif")
        meta_h # measured once, before the pages are drawn side by side
        frames = pages.each_with_index.map do |page, i|
          Thread.new do
            out = File.join(dir, "page-#{i}.png")
            run(page_command(page, i) + ["-strip", "PNG24:#{out}"])
            ["-delay", delay(page, last: i == pages.size - 1).to_s, out]
          end
        end.map(&:value)
        out = File.join(dir, "card.gif")
        # One palette for every page, and no dithering, so the pages only differ where the
        # words do and the GIF stays small
        run(frames.flatten + ["+dither", "-colors", "128", "-loop", "0", "-layers", "Optimize", out])
      else
        file = ShareCard::DIR.join("#{key}.png")
        out = File.join(dir, "card.png")
        run(command + ["-strip", "PNG24:#{out}"])
      end
      FileUtils.mv(out, file)
      @cached = file
    end
  end

  # One moving picture's page: part of the quote, or the note on its own (`quote` "")
  # `cont`: it starts mid-sentence; `whole`: it ends where a paragraph does
  Page = Struct.new(:quote, :note, :first, :last, :cont, :whole, keyword_init: true)

  # Its pages: the whole quote on one when it fits at a size people can read, otherwise a
  # few at PAGE_SIZE, broken between sentences (or words, for a very long one), the note
  # on the last (or a page of its own when it won't fit there)
  def pages
    @pages ||= begin
      words = still ? quote : long
      if still || fits?(words, font_size: READABLE[size], note: note)
        [Page.new(quote: words, note: note, first: true, last: true)]
      else
        paginate(words)
      end
    end
  end

  private

  def clean(value) = value.to_s.gsub(/[^[:print:]\n]/, " ").gsub(/[ \t]+/, " ").gsub(/ *\n */, "\n").strip

  def run(args)
    _out, err, status = Open3.capture3(*ShareCard.magick, *args)
    raise ShareCard::Failed, err.to_s.first(500) unless status.success?
  end

  def caption(value) = "caption:#{escape(value)}"

  def spacing(font, size) = font == :hand ? (-size * 0.18).round : (look == "marker" && font == :bold ? (size * 0.22).round : (size * 0.08).round)

  def cached
    @cached ||= ShareCard::DIR.join("#{key}.png").then { |f| f.exist? ? f : nil } ||
                Dir.glob(ShareCard::DIR.join("#{key}-*.{gif,mp4}").to_s).first&.then { |f| Pathname(f) }
  end

  # How tall words come out, each paragraph wrapped on its own and a para_gap between them.
  # `quote: true`: set the way the reading set them (see #parts)
  def measure(value, font:, size:, width:, quote: false)
    list = pieces(value, font: font, size: size, width: width, quote: quote).presence || [["", { font: font, size: size, kern: 0 }, 0]]
    args = list.flat_map do |p, st|
      ["-font", FONTS[st[:font]], "-pointsize", st[:size].to_s, "-kerning", st[:kern].to_s,
       "-interline-spacing", spacing(st[:font], st[:size]).to_s, caption(italic?(st[:font]) ? "#{p}\u00A0" : p)]
    end
    out, err, status = Open3.capture3(*ShareCard.magick, "-size", "#{width}x", *args, "-format", "%h\n", "info:")
    # ImageMagick 6.9.11 (Debian's, on the server) won't lay out a caption that comes out
    # very tall (over about 2,000 pixels) and says "width or height exceeds limit": that's
    # just too big
    return TOO_TALL if !status.success? && err.include?("exceeds limit")
    raise ShareCard::Failed, err.to_s.first(500) unless status.success?

    out.split.sum(&:to_i) + list.sum { |_, _, gap| gap }
  end

  # The server's ImageMagick (6.9.11, with Debian's 16,000 pixel width limit) won't lay out
  # a caption whose words would be wider than that on one line, newlines or not: about 300
  # letters at 53 points. So a paragraph longer than that is wrapped here and drawn in a
  # few captions of whole lines, stacked one under the other.
  CAPTION_LIMIT = 11_000

  # #parts with long paragraphs cut into groups of lines: [words, how they're set, the room above]
  def pieces(value, font:, size:, width:, color: nil, under: nil, quote: false)
    parts(value, font: font, size: size, color: color, under: under, quote: quote).each_with_index.flat_map do |(p, st), i|
      ink = st[:size] + st[:kern]
      groups = if @lines_mode then wrap(p, st[:font], st[:size], st[:kern], width)
      elsif p.length * ink <= CAPTION_LIMIT then [p]
      else
        wrap(p, st[:font], st[:size], st[:kern], width).each_with_object([[]]) do |line, acc|
          acc << [] if acc.last.any? && (acc.last.sum(&:length) + line.length + acc.last.size) * ink > CAPTION_LIMIT
          acc.last << line
        end.map { |lines| lines.join("\n") }
      end
      m = metrics(st[:font], "")
      between = [((m[:step] - m[:line]) * st[:size] / 100.0).round, 0].max
      groups.each_with_index.map { |g, j| [g, st, j.zero? ? (i.zero? ? 0 : para_gap(size)) : between] }
    end
  end

  # Its paragraphs: lines with words on them
  def paragraphs(value) = value.to_s.split(/\n+/).map(&:strip).reject(&:empty?)

  # The room between two paragraphs: about half a line
  def para_gap(size) = (size * 0.55).round

  # Each paragraph and how it's set: [words, { font:, size:, color:, kern:, under: }]. The
  # quote's paragraphs (`quote: true`) keep the reading's own look when we know it: its
  # headings bigger and bold, its italics in italics, a small capitals line like where it's
  # from small and spaced out, and the rest upright.
  def parts(value, font:, size:, color: nil, under: nil, quote: false)
    paragraphs(value).map do |p|
      st = { font: font, size: size, color: color, kern: 0, under: under }
      [p, quote ? st.merge(formatted(format_of(p), size)) : st]
    end
  end

  def formatted(kind, q)
    serif = %w[paper night].include?(look)
    case kind
    when :title then { font: serif ? :serif_bold : :bold, size: (q * 1.15).round }
    when :subhead then { font: :semibold, size: (q * 0.6).round, kern: (q * 0.1).round, color: style[:source_color], under: nil }
    when :italic then { font: :serif, size: (q * 0.92).round }
    when :caps then { font: :semibold, size: (q * 0.5).round, kern: (q * 0.06).round, color: style[:source_color], under: nil }
    when :body then { font: serif ? :serif_upright : style[:quote_font], size: (q * 0.88).round }
    else {}
    end
  end

  # How the reading set this paragraph (or the part of one a page has), or nil when we don't know
  def format_of(para)
    return nil if formats.empty?

    words = para.sub(/\A[“…]+/, "").sub(/[”…]+\z/, "")
    formats[words] || formats.find { |t, _| t.include?(words) }&.last || :body
  end

  # The reading's paragraphs and how each was set: from the chapter (QuoteCard.highlight), or
  # for a daily reading we know nothing about, its date and title
  def formats
    @formats ||= if @given_formats.present? then @given_formats
    elsif reading?
      list = paragraphs(long)
      list.each_with_index.to_h do |p, i|
        [p, if i.zero? then :subhead
            elsif i == 1 && self.class.caps?(p) then :title
            elsif self.class.caps?(p) then :caps
            else :body
            end]
      end
    else {}
    end
  end

  # About how tall wrapped words come out, without asking ImageMagick to wrap them (which
  # takes it longer the longer they are): each word's width is measured once, at 100 points,
  # and the lines are wrapped here a little narrower than the real ones, so the guess never
  # comes out shorter than the real thing
  def estimate(value, font:, size:, width:, quote: false)
    list = parts(value, font: font, size: size, quote: quote)
    return estimate_one("", font, size, 0, width) if list.empty?

    list.sum { |p, st| estimate_one(p, st[:font], st[:size], st[:kern], width) } + ((list.size - 1) * para_gap(size))
  end

  # One paragraph's height
  def estimate_one(para, font, size, kern, width)
    m = metrics(font, para)
    scale = size / 100.0
    lines = wrap(para, font, size, kern, width, count: true)
    ((m[:line] + ((lines - 1) * m[:step])) * scale).ceil
  end

  # A paragraph's lines, wrapped a little narrower than ImageMagick would (so it never wraps
  # them again), or with `count: true` how many lines it takes (a word too long for a line counts as more)
  def wrap(para, font, size, kern, width, count: false)
    m = metrics(font, para)
    scale = size / 100.0
    limit = width * (kern.positive? ? 0.9 : 0.95) / scale
    space = m[:space] + (kern / scale)
    lines = [[]]
    extra = 0
    line = nil
    para.split(/ +/).each do |word|
      w = (m[:words][word] || (m[:em] * word.length)) + (kern / scale * word.length)
      extra += (w / limit).floor if w > limit
      if line.nil? then line = w
      elsif line + space + w <= limit then line += space + w
      else
        lines << []
        line = w
      end
      lines.last << word
    end
    count ? lines.size + extra : lines.map { |l| l.join(" ") }
  end

  # A font's word widths (at 100 points), its space, and its line heights, measured in one go
  def metrics(font, value)
    @metrics ||= {}
    m = @metrics[font] ||= begin
      out = magick("-size", "2000x", "-font", FONTS[font], "-pointsize", "100", "-interline-spacing", spacing(font, 100).to_s,
                   caption("Ag"), caption("Ag\nAg"), "+size", "label:x x", "label:xx", "label:M", "-format", "%w %h\n", "info:")
      (one, two, spaced, close, em) = out.lines.map { |l| l.split.map(&:to_i) }
      { line: one[1], step: two[1] - one[1], space: spaced[0] - close[0], em: em[0], words: {} }
    end
    missing = value.split(/\s+/).uniq.reject { |w| w.empty? || m[:words].key?(w) }
    missing.each_slice(400) do |batch|
      out = magick("-font", FONTS[font], "-pointsize", "100", *batch.map { |w| "label:#{escape(w)}" }, "-format", "%w\n", "info:")
      batch.zip(out.split("\n").map(&:to_i)).each { |w, px| m[:words][w] = px }
    end
    m
  end

  def magick(*args)
    out, err, status = Open3.capture3(*ShareCard.magick, *args)
    raise ShareCard::Failed, err.to_s.first(500) unless status.success?

    out
  end

  # Text for label: and caption:, which read "@file" and expand "%x" and "\n" otherwise
  def escape(value) = value.gsub('\\') { '\\\\' }.gsub('%', '%%').sub(/\A@/) { '\\@' }

  # One block of wrapped text laid on the canvas at x,y, each paragraph wrapped on its own
  # and stacked with a para_gap between them, cut to `height`. `under` paints each line's
  # background (a highlighter). Left-aligned text goes without -gravity: with NorthWest,
  # ImageMagick 6 paints each line's background as wide as the line before it.
  def block(value, font:, size:, color:, width:, height:, x:, y:, under: nil, quote: false)
    return [] if @no_text

    record_bands(value, font: font, size: size, width: width, quote: quote, y: y, height: height) if @bands
    args = ["(", "-background", "none"]
    args += wide? ? ["+gravity"] : ["-gravity", "North"]
    pieces(value, font: font, size: size, width: width, color: color, under: under, quote: quote).each do |p, st, gap|
      args += ["-size", "#{width}x#{gap}", "xc:none"] if gap.positive?
      args += ["-fill", st[:color] || color, "-font", FONTS[st[:font]], "-pointsize", st[:size].to_s, "-kerning", st[:kern].to_s,
               "-interline-spacing", spacing(st[:font], st[:size]).to_s, "-undercolor", st[:under] || "none",
               "-size", "#{width}x", caption(italic?(st[:font]) ? "#{p}\u00A0" : p)]
    end
    # Settings after the captions are drawn: they shape only the stack
    args + ["-undercolor", "none", "-gravity", "NorthWest", "-append", "-extent", "#{width}x#{height}",
            ")", "-gravity", "NorthWest", "-geometry", "+#{x}+#{y}", "-composite"]
  end

  # A video's bands: where each line of this block lands, [top, height, starts a paragraph]
  def record_bands(value, font:, size:, width:, quote:, y:, height:)
    list = pieces(value, font: font, size: size, width: width, quote: quote)
    args = list.flat_map do |p, st|
      ["-font", FONTS[st[:font]], "-pointsize", st[:size].to_s, "-kerning", st[:kern].to_s,
       "-interline-spacing", spacing(st[:font], st[:size]).to_s, caption(italic?(st[:font]) ? "#{p}\u00A0" : p)]
    end
    heights = magick("-size", "#{width}x", *args, "-format", "%h\n", "info:").split.map(&:to_i)
    top = y
    list.zip(heights).each_with_index do |((_, _, gap), h), i|
      top += gap
      break if top >= y + height

      @bands << [top, [h, y + height - top].min, i.zero? || gap >= para_gap(size)]
      top += h
    end
  end

  # A video, MP4: each page drawn twice, without its words and with them a line per caption
  # (so we know where each line is), then ffmpeg fades the lines in one after another over
  # the empty page, holds it long enough to read, and crossfades to the next page.
  FPS = 24
  FADE = 0.8     # how long a line takes to fade in
  STAGGER = 0.38 # between one line starting and the next
  CROSSFADE = 0.7

  # One video drawn at a time: ffmpeg takes every core it can for a few seconds
  VIDEO_LOCK = Mutex.new

  def render_video(dir) = VIDEO_LOCK.synchronize { draw_video(dir) }

  def draw_video(dir)
    segments = pages.each_with_index.map do |page, i|
      full = File.join(dir, "full-#{i}.png")
      empty = File.join(dir, "empty-#{i}.png")
      begin
        @lines_mode = true
        @bands = []
        run(frame_command(page, i) + ["-strip", "PNG24:#{full}"])
        bands = @bands
        @bands = nil
        @no_text = true
        run(frame_command(page, i) + ["-strip", "PNG24:#{empty}"])
      ensure
        @lines_mode = @no_text = false
        @bands = nil
      end
      t = 0.5
      starts = bands.each_with_index.map do |(_, _, para), j|
        t += 0.3 if para && j.positive?
        at = t
        t += STAGGER
        at
      end
      words = "#{page.quote} #{page.note}".split.size
      hold = (words / 4.5).clamp(2.5, 6.0) + (i == pages.size - 1 ? 1.5 : 0)
      { full: full, empty: empty, bands: bands, starts: starts, length: (starts.last || 0) + FADE + hold }
    end

    # Each picture read once and repeated (the loop filter), not decoded again for every frame
    inputs = segments.flat_map { |seg| ["-i", seg[:empty], "-i", seg[:full]] }
    graph = []
    segments.each_with_index do |seg, k|
      n = seg[:bands].size
      frames = (seg[:length] * FPS).ceil
      repeat = "loop=loop=#{frames - 1}:size=1:start=0,setpts=N/#{FPS}/TB"
      base = "e#{k}"
      graph << "[#{2 * k}:v]format=yuv420p,#{repeat}[#{base}]"
      if n.zero?
        graph << "[#{base}]setsar=1[s#{k}]"
        next
      end
      # A mask one pixel wide, each band's rows as clear as its line has faded in, stretched
      # across: the page with its words shows through it onto the empty page. One mask and
      # one overlay a frame, however many lines.
      alpha = seg[:bands].each_with_index.map do |(top, h, _), j|
        "between(Y,#{top},#{top + h - 1})*clip((T-#{format('%.2f', seg[:starts][j])})/#{FADE},0,1)"
      end.join("+")
      graph << "color=c=black:s=1x#{height}:r=#{FPS}:d=#{format('%.4f', frames.to_f / FPS)},format=gray,geq=lum='255*min(1,#{alpha})',scale=#{width}:#{height}:flags=neighbor[m#{k}]"
      graph << "[#{(2 * k) + 1}:v]format=yuv420p,#{repeat}[f#{k}]"
      graph << "[f#{k}][m#{k}]alphamerge[a#{k}]"
      graph << "[#{base}][a#{k}]overlay=0:0:format=yuv420,setsar=1[s#{k}]"
    end
    offset = 0
    final = "s0"
    segments.each_with_index.drop(1).each do |seg, k|
      offset += segments[k - 1][:length] - CROSSFADE
      graph << "[#{final}][s#{k}]xfade=transition=fade:duration=#{CROSSFADE}:offset=#{format('%.2f', offset)}[x#{k}]"
      final = "x#{k}"
    end
    out = File.join(dir, "card.mp4")
    _o, err, status = Open3.capture3("ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs, "-filter_complex", graph.join(";"),
                                     "-map", "[#{final}]", "-r", FPS.to_s, "-c:v", "libx264", "-preset", "superfast", "-tune", "stillimage", "-crf", "22",
                                     "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out)
    raise ShareCard::Failed, "ffmpeg: #{err.to_s.first(500)}" unless status.success?

    out
  end

  # One page as a picture: the page of a moving picture, or the one picture
  def frame_command(page, i) = pages.size > 1 ? page_command(page, i) : command

  # Italics lean past the end of their line; a space after keeps the last letter whole
  def italic?(font) = %i[serif hand].include?(font)

  def wide? = size == "wide"
  def margin = wide? ? 84 : 96
  def text_width = width - (2 * margin) - (look == "marker" ? 24 : 0)

  # How each look sets its words: fonts, colors, the background
  def style
    case look
    when "paper"
      { bg: ["-size", "#{width}x#{height}", "gradient:#fdfaf3-#f4ecdc"], quote_font: kind == :note ? :serif_bold : :serif, quote_color: "#2a2118",
        note_font: :hand, note_color: "#2449a8", source_color: "#8a7350", mark: "#c8a46a", badge: :dark }
    when "marker"
      { bg: ["-size", "#{width}x#{height}", "xc:#ffffff"], quote_font: :bold, quote_color: "#0f172a", under: color,
        note_font: :hand, note_color: "#334155", source_color: "#64748b", badge: :dark }
    when "night"
      { bg: ["-size", "#{width}x#{height}", "-define", "gradient:angle=160", "gradient:#1e293b-#0b1120"], quote_font: kind == :note ? :serif_bold : :serif,
        quote_color: "#f8fafc", note_font: :regular, note_color: "#cbd5e1", source_color: "#94a3b8", mark: color, badge: :light }
    else
      { bg: ["-size", "#{width}x#{height}", "-define", "gradient:angle=150", "gradient:#fb923c-#db2777"], quote_font: :bold, quote_color: "#ffffff",
        note_font: :regular, note_color: "rgba(255,255,255,0.92)", source_color: "rgba(255,255,255,0.85)", badge: :light }
    end
  end

  # The quote as big as fits with everything else, from the top of the room down
  def command
    s = style
    page = pages.first
    words = quoted(page.quote)

    big = { "wide" => 60, "square" => 74, "story" => 86 }[size]
    q_size = big
    q_h = n_size = n_h = 0
    loop do
      q_h = estimate(words, font: s[:quote_font], size: q_size, width: text_width, quote: true)
      n_size = note_size(q_size)
      n_h = note ? estimate(note, font: s[:note_font], size: n_size, width: text_width) : 0
      break if total(mark_h, q_h, n_h, meta_h) <= room || q_size <= 26

      q_size = (q_size * 0.9).floor
    end
    # The real heights, at the size the guess picked
    q_h = measure(words, font: s[:quote_font], size: q_size, width: text_width, quote: true)
    n_h = note ? measure(note, font: s[:note_font], size: n_size, width: text_width) : 0
    # Still too long at the smallest size: cut where the room ends
    q_h = [q_h, room - total(mark_h, 0, n_h, meta_h)].min.clamp(q_size * 2, room)
    layout(words, q_size: q_size, q_h: q_h, note: note, n_size: n_size, n_h: n_h)
  end

  # Page `i` of a moving picture: its words at PAGE_SIZE, and dots saying which page it is
  def page_command(page, i)
    s = style
    q_size = PAGE_SIZE[size]
    words = page.quote.empty? ? nil : quoted(page.quote, first: page.first, last: page.last, cont: page.cont, whole: page.whole)
    q_h = words ? measure(words, font: s[:quote_font], size: q_size, width: text_width, quote: true) : 0
    n_size = note_size(q_size)
    n_h = page.note ? measure(page.note, font: s[:note_font], size: n_size, width: text_width) : 0
    q_h = [q_h, room - total(mark_h, 0, n_h, meta_h)].min if words
    layout(words, q_size: q_size, q_h: q_h, note: page.note, n_size: n_size, n_h: n_h) + dots(i, pages.size)
  end

  # Everything on one picture, the words in the middle of the room
  def layout(words, q_size:, q_h:, note:, n_size:, n_h:)
    s = style
    y = room_top + [(room - total(mark_h, q_h, n_h, meta_h)) / 2, 0].max
    args = s[:bg].dup
    if s[:mark]
      args += mark(s[:mark], y)
      y += mark_h
    end
    if words
      args += block(words, font: s[:quote_font], size: q_size, color: s[:quote_color], width: text_width, height: q_h,
                           x: x_for, y: y, under: s[:under], quote: true)
      y += q_h
    end
    if note
      y += gap if words
      args += block(note, font: s[:note_font], size: n_size, color: s[:note_color], width: text_width, height: n_h, x: x_for, y: y)
      y += n_h
    end
    if meta_line
      y += gap
      args += block(meta_line, font: :semibold, size: meta_size, color: s[:source_color], width: text_width, height: meta_h, x: x_for, y: y)
    end
    args + badge(light: s[:badge] == :light)
  end

  # A highlight's words in quote marks. A page that stops mid-sentence ends with "…" and
  # the next starts with one; between sentences or paragraphs (`whole`) the dots say there's more.
  def quoted(text, first: true, last: true, cont: !first, whole: false)
    open, close = kind == :highlight && !reading? && !formats.value?(:title) && !formats.value?(:subhead) ? ["“", "”"] : ["", ""]
    start = first ? open : (cont ? "…" : "")
    if last then stop = close
    elsif whole || text.match?(/[.!?…]["”’)]?\z/) then stop = ""
    else
      text = text.sub(/[,;:—–]\z/, "")
      stop = "…"
    end
    "#{start}#{text}#{stop}"
  end

  # A daily reading (it starts with its date, like "NOVEMBER 7"): shown as it is, no quote marks
  def reading? = long.match?(/\A(#{Date::MONTHNAMES.compact.join('|')}) \d{1,2}\b/i)

  def note_size(q_size) = (q_size * (style[:note_font] == :hand ? 0.8 : 0.58)).round.clamp(26, 64)
  def meta_line = [source, (by && (kind == :highlight ? "Highlighted by #{by}" : "— #{by}"))].compact.join("  ·  ").presence
  def meta_h = @meta_h ||= meta_line ? measure(meta_line, font: :semibold, size: meta_size, width: text_width) : 0
  def mark_h = style[:mark] ? (wide? ? 60 : 96) : 0
  def room_top = margin + safe
  def room = badge_y - (wide? ? 28 : 56) - room_top

  # Whether these words (and note) fit one picture at this size, with where it's from
  def fits?(text, font_size:, note: nil, first: true, last: true)
    q_h = text.empty? ? 0 : estimate(quoted(text, first: first, last: last), font: style[:quote_font], size: font_size, width: text_width, quote: true)
    n_h = note ? estimate(note, font: style[:note_font], size: note_size(font_size), width: text_width) : 0
    total(mark_h, q_h, n_h, meta_h) <= room
  end

  # The long words in pages that each fit at PAGE_SIZE. A page ends between paragraphs when
  # the next one won't fit and the page is already half full; otherwise whole sentences while
  # they fit (again breaking early only on a half-full page), and a sentence too long for
  # what's left broken between words. Past PAGES_MAX it's cut with "…".
  def paginate(words)
    font_size = PAGE_SIZE[size]
    # [sentence, whether it starts a paragraph, its paragraph]
    queue = paragraphs(words).flat_map do |para|
      para.split(/(?<=[.!?…;:])\s+/).each_with_index.map { |sentence, i| [sentence, i.zero?, para] }
    end
    chunks = []
    ends = [] # whether each page ends where a paragraph does
    close = lambda do |text|
      chunks << text
      ends << (queue.empty? || queue.first[1])
    end
    current = nil
    join = ->(unit) { current ? "#{current}#{unit[1] ? "\n" : " "}#{unit[0]}" : unit[0] }
    while (unit = queue.shift)
      if chunks.size >= PAGES_MAX
        queue.unshift(unit)
        break
      end
      first = chunks.empty?
      # A new paragraph that won't fit here starts the next page, if this one has enough on it
      if current && unit[1] && !fits?(join.([unit[2], true]), font_size: font_size, first: first, last: false) && half_full?(current, font_size, first: first)
        queue.unshift(unit)
        close.(current)
        current = nil
        next
      end
      candidate = join.(unit)
      if fits?(candidate, font_size: font_size, first: first, last: false)
        current = candidate
      elsif current && half_full?(current, font_size, first: first)
        queue.unshift(unit)
        close.(current)
        current = nil
      else
        head, rest = most_words(unit[0], font_size, first: first, before: current && "#{current}#{unit[1] ? "\n" : " "}")
        queue.unshift([rest, head.empty? && unit[1], unit[2]]) if rest.present?
        close.(head.empty? ? current : join.([head, unit[1]]))
        current = nil
      end
    end
    close.(current) if current && chunks.size < PAGES_MAX
    chunks[-1] = "#{chunks[-1].sub(/[[:punct:]]*\z/, '')}…" if queue.any? || (current && !chunks.include?(current))

    pages = chunks.each_with_index.map do |c, i|
      Page.new(quote: c, first: i.zero?, last: i == chunks.size - 1, whole: ends[i],
               cont: i.positive? && !ends[i - 1] && !chunks[i - 1].match?(/[.!?…]["”’)]?\z/))
    end
    if note
      if fits?(pages.last.quote, font_size: font_size, note: note, first: pages.size == 1, last: true)
        pages.last.note = note
      else
        pages << Page.new(quote: "", note: note, first: false, last: true)
      end
    end
    pages
  end

  # As many of a sentence's words as fit a page (after `before`, what's on it already), and
  # the rest. With nothing before it, at least one word.
  def most_words(sentence, font_size, first:, before: nil)
    list = sentence.split
    lo, hi = (before ? 0 : 1), list.size
    while lo < hi
      mid = (lo + hi + 1) / 2
      fits?("#{before}#{list.first(mid).join(' ')}", font_size: font_size, first: first, last: false) ? lo = mid : hi = mid - 1
    end
    # Cut after a comma, when there's one late enough, rather than mid-phrase
    if lo < list.size && (comma = (lo - 1).downto(lo / 2).find { |i| i.positive? && list[i - 1].match?(/[,;:—–]\z/) })
      lo = comma
    end
    [list.first(lo).join(" "), list.drop(lo).join(" ")]
  end

  # Whether a page already has at least half its room filled
  def half_full?(text, font_size, first:)
    q_h = estimate(quoted(text, first: first, last: false), font: style[:quote_font], size: font_size, width: text_width, quote: true)
    total(mark_h, q_h, 0, meta_h) >= room * 0.5
  end

  # How long a page shows, in hundredths of a second: time to read it, a little more on the last
  def delay(page, last:)
    count = "#{page.quote} #{page.note}".split.size
    seconds = (2.0 + (count / 3.5)).clamp(4.0, 14.0) + (last ? 1.5 : 0)
    (seconds * 100).round
  end

  # A row of dots, the page it's on filled in: in the middle above the badge, or on wide
  # pictures at the left beside it
  def dots(i, count)
    s = style
    r = wide? ? 7 : 9
    step = r * 3.4
    cy = wide? ? badge_y + 32 : badge_y - 30
    x0 = wide? ? margin + r : (width - (step * (count - 1))) / 2
    draws = (0...count).map do |n|
      cx = (x0 + (n * step)).round
      # Each in its own context: ImageMagick 6 multiplies one fill-opacity into the next
      "push graphic-context fill-opacity #{n == i ? 1 : 0.28} circle #{cx},#{cy} #{cx + r},#{cy} pop graphic-context"
    end
    ["-fill", s[:quote_color], "-draw", draws.join(" ")]
  end

  # Stories put their app's buttons over the top and bottom of the picture: keep clear of them
  def safe = size == "story" ? 160 : 0
  def badge_y = height - 64 - (wide? ? 32 : 64) - safe

  def x_for = margin + (look == "marker" ? 12 : 0)
  def gap = wide? ? 26 : 44
  def meta_size = wide? ? 24 : 30

  def total(mark_h, q_h, n_h, m_h)
    mark_h + q_h + (n_h.positive? ? gap + n_h : 0) + (m_h.positive? ? gap + m_h : 0)
  end

  # A short bar of the highlight's color (night) or a printer's rule (paper) over the quote
  def mark(color, y)
    w = wide? ? 96 : 120
    h = wide? ? 10 : 12
    x = wide? ? margin : (width - w) / 2
    ["-fill", color, "-draw", "roundrectangle #{x},#{y + 10} #{x + w},#{y + 10 + h} #{h / 2},#{h / 2}"]
  end

  # RecoveryBot at the bottom: a pill with the mark and the name, right on wide pictures and
  # in the middle on the others
  def badge(light: true)
    fill = light ? "white" : "#17191c"
    ink = light ? "#17191c" : "white"
    mark = ASSETS.join(light ? "recoverybot-mark-dark.png" : "recoverybot-mark-light.png").to_s
    w, h = 300, 64
    x = wide? ? width - w - 36 : (width - w) / 2
    y = badge_y
    ["-undercolor", "none", "(", "-size", "#{w}x#{h}", "xc:none", "-fill", fill, "-draw", "roundrectangle 0,0 #{w - 1},#{h - 1} 32,32",
     "(", mark, "-resize", "x34", ")", "-gravity", "West", "-geometry", "+24+0", "-composite",
     "-fill", ink, "-font", FONTS[:bold], "-pointsize", "30", "-gravity", "West", "-annotate", "+84+0", "RecoveryBot", ")",
     "-gravity", "NorthWest", "-geometry", "+#{x}+#{y}", "-composite"]
  end
end
