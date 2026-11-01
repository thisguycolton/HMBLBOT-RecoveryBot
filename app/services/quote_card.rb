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
class QuoteCard
  VERSION = 1
  LOOKS = %w[paper marker night sunrise].freeze
  SIZES = { "wide" => [1200, 630], "square" => [1080, 1080], "story" => [1080, 1920] }.freeze
  ASSETS = ShareCard::ASSETS
  FONTS = ShareCard::FONTS.merge(
    serif: ASSETS.join("Lora_500MediumItalic.ttf").to_s,
    serif_bold: ASSETS.join("Lora_600SemiBold.ttf").to_s,
    hand: ASSETS.join("Caveat_600SemiBold.ttf").to_s
  )
  QUOTE_MAX = 420
  NOTE_MAX = 280
  HIGHLIGHT_COLORS = { "yellow" => "#fef08a", "lime" => "#bef264", "cyan" => "#a5f3fc", "pink" => "#fbcfe8", "orange" => "#fed7aa" }.freeze

  attr_reader :look, :size, :quote, :note, :source, :by, :color, :kind

  # kind: :highlight (a quote, maybe with its note) or :note (their own words)
  def initialize(quote:, kind: :highlight, note: nil, source: nil, by: nil, color: nil, look: "paper", size: "wide")
    @kind = kind.to_sym
    @look = LOOKS.include?(look.to_s) ? look.to_s : LOOKS.first
    @size = SIZES.key?(size.to_s) ? size.to_s : "wide"
    @quote = clean(quote).truncate(QUOTE_MAX, separator: " ")
    @note = clean(note).truncate(NOTE_MAX, separator: " ").presence
    @source = clean(source).truncate(90).presence
    @by = clean(by).truncate(40).presence
    @color = HIGHLIGHT_COLORS[color.to_s] || (color.to_s.match?(/\A#\h{6}\z/) ? color.to_s : HIGHLIGHT_COLORS["yellow"])
  end

  # A highlight's picture. `note:` false leaves its note out, `name:` true puts their first
  # name on it. A note with blocked words in it (from before the filter) is always left out.
  def self.highlight(h, look: nil, size: nil, note: true, name: false)
    words = note && h.note.present? && !BlockedLanguage.found?(h.note) ? plain(h.note) : nil
    new(kind: :highlight, quote: h.quote, note: words, source: "#{h.chapter.book.title} · #{h.chapter.title}",
        by: (h.user.display_name.to_s.split.first if name), color: h.style.is_a?(Hash) ? h.style["color"] : nil, look: look, size: size)
  end

  # A note's picture: its words (no pictures, links or chips)
  def self.note(n, look: nil, size: nil, name: false)
    new(kind: :note, quote: plain(n.body), by: (n.user.display_name.to_s.split.first if name), look: look, size: size)
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
    Digest::SHA256.hexdigest(["quote", VERSION, kind, look, size, quote, note, source, by, color].to_json).first(32)
  end

  def filename
    words = quote.parameterize.split("-").first(5).join("-").presence || "recoverybot"
    "#{words}-#{size}.png"
  end

  # The PNG's path, drawn now if it isn't there yet
  def path
    file = ShareCard::DIR.join("#{key}.png")
    return file if file.exist?

    FileUtils.mkdir_p(ShareCard::DIR)
    Dir.mktmpdir("quote-card") do |dir|
      out = File.join(dir, "card.png")
      run(command + ["-strip", "PNG24:#{out}"])
      FileUtils.mv(out, file)
    end
    file
  end

  private

  def clean(value) = value.to_s.gsub(/[^[:print:]\n]/, " ").gsub(/[ \t]+/, " ").gsub(/ *\n */, "\n").strip

  def run(args)
    _out, err, status = Open3.capture3(*ShareCard.magick, *args)
    raise ShareCard::Failed, err.to_s.first(500) unless status.success?
  end

  # Text for caption:, which reads "@file" and expands "%x" and "\n" otherwise
  def caption(value) = "caption:#{value.gsub('\\') { '\\\\' }.gsub('%', '%%').sub(/\A@/) { '\\@' }}"

  def spacing(font, size) = font == :hand ? (-size * 0.18).round : (look == "marker" && font == :bold ? (size * 0.22).round : (size * 0.08).round)

  def measure(value, font:, size:, width:)
    out, err, status = Open3.capture3(*ShareCard.magick, "-size", "#{width}x", "-font", FONTS[font], "-pointsize", size.to_s,
                                      "-interline-spacing", spacing(font, size).to_s, caption(italic?(font) ? "#{value}\u00A0" : value), "-format", "%h", "info:")
    raise ShareCard::Failed, err.to_s.first(500) unless status.success?

    out.to_i
  end

  # One block of wrapped text laid on the canvas at x,y. `under` paints each line's
  # background (a highlighter). Left-aligned text goes without -gravity: with NorthWest,
  # ImageMagick 6 paints each line's background as wide as the line before it.
  def block(value, font:, size:, color:, width:, height:, x:, y:, under: nil)
    args = ["(", "-size", "#{width}x#{height}", "-background", "none", "-fill", color, "-font", FONTS[font],
            "-pointsize", size.to_s, "-interline-spacing", spacing(font, size).to_s, "-undercolor", under || "none"]
    args += wide? ? ["+gravity"] : ["-gravity", "North"]
    args + [caption(italic?(font) ? "#{value}\u00A0" : value), ")", "-gravity", "NorthWest", "-geometry", "+#{x}+#{y}", "-composite"]
  end

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
    room_top = margin + safe
    room_bottom = badge_y - (wide? ? 28 : 56)
    room = room_bottom - room_top
    words = kind == :highlight ? "“#{quote}”" : quote
    meta = [source, (by && (kind == :highlight ? "Highlighted by #{by}" : "— #{by}"))].compact.join("  ·  ").presence
    mark_h = s[:mark] ? (wide? ? 60 : 96) : 0

    big = { "wide" => 60, "square" => 74, "story" => 86 }[size]
    q_size = big
    q_h = n_size = n_h = m_h = 0
    loop do
      q_h = measure(words, font: s[:quote_font], size: q_size, width: text_width)
      n_size = (q_size * (s[:note_font] == :hand ? 0.8 : 0.58)).round.clamp(26, 64)
      n_h = note ? measure(note, font: s[:note_font], size: n_size, width: text_width) : 0
      m_h = meta ? measure(meta, font: :semibold, size: meta_size, width: text_width) : 0
      break if total(mark_h, q_h, n_h, m_h) <= room || q_size <= 26

      q_size = (q_size * 0.9).floor
    end
    # Still too long at the smallest size: cut where the room ends
    q_h = [q_h, room - total(mark_h, 0, n_h, m_h)].min.clamp(q_size * 2, room)

    y = room_top + [(room - total(mark_h, q_h, n_h, m_h)) / 2, 0].max
    args = s[:bg].dup
    if s[:mark]
      args += mark(s[:mark], y)
      y += mark_h
    end
    args += block(words, font: s[:quote_font], size: q_size, color: s[:quote_color], width: text_width, height: q_h,
                         x: x_for, y: y, under: s[:under])
    y += q_h
    if note
      y += gap
      args += block(note, font: s[:note_font], size: n_size, color: s[:note_color], width: text_width, height: n_h, x: x_for, y: y)
      y += n_h
    end
    if meta
      y += gap
      args += block(meta, font: :semibold, size: meta_size, color: s[:source_color], width: text_width, height: m_h, x: x_for, y: y)
    end
    args + badge(light: s[:badge] == :light)
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
