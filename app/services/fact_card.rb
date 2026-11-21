# A fun day-count fact (DayFacts) as a picture to share: the day count big, the fact under it
# and the RecoveryBot badge, drawn with ImageMagick like ShareCard (whose helpers it borrows).
# It names nobody and says nothing about whose count it is.
#   look - color (the fact's topic colors), night, paper or sunrise
#   size - square (posts), story (9:16, stories) or wide (1200×630, link previews)
# Kept in tmp/share_cards under a key of everything drawn, so each one is drawn once.
class FactCard < ShareCard
  VERSION = 2
  LOOKS = %w[color night paper sunrise].freeze
  SIZES = { "square" => [1080, 1080], "story" => [1080, 1920], "wide" => [1200, 630] }.freeze
  # [dark corner, light corner, accent on light looks]
  TOPIC_COLORS = {
    "space" => %w[#1e1b4b #7c3aed #6d28d9], "nature" => %w[#064e3b #10b981 #047857],
    "history" => %w[#7c2d12 #f59e0b #b45309], "numbers" => %w[#172554 #0ea5e9 #1d4ed8],
    "body" => %w[#881337 #fb7185 #be123c]
  }.freeze

  attr_reader :fact, :look, :size

  def initialize(fact, look: nil, size: nil)
    @fact = fact
    @look = LOOKS.include?(look.to_s) ? look.to_s : LOOKS.first
    @size = SIZES.key?(size.to_s) ? size.to_s : "square"
    @logo = @cover = nil
  end

  def width = SIZES[size][0]
  def height = SIZES[size][1]

  def key
    Digest::SHA256.hexdigest(["fact", VERSION, fact.days, fact.topic, fact.title, fact.detail, look, size].to_json).first(32)
  end

  # What SendsQuoteCards needs to send it
  def content_type = "image/png"
  def filename = "recoverybot-fun-fact-#{fact.days}-#{size}.png"
  def page_count = 1
  def progress=(_token); end

  private

  def wide? = size == "wide"
  def story? = size == "story"
  def light? = look == "paper"
  def ink = light? ? "#1c1917" : "white"
  def soft_ink = light? ? "#57534e" : "rgba(255,255,255,0.86)"
  def colors = TOPIC_COLORS.fetch(fact.topic, TOPIC_COLORS["numbers"])
  def accent = light? ? colors[2] : (look == "night" ? colors[1] : "rgba(255,255,255,0.82)")

  def command(_dir, out)
    m = wide? ? 72 : 96
    text_w = width - (2 * m)
    top = story? ? 250 : m
    bottom = height - (story? ? 300 : (wide? ? 120 : 190)) # the badge sits below this
    num_size, unit_size, title_size, detail_size = if wide? then [124, 44, 50, 29]
                                                   elsif story? then [250, 76, 78, 46]
                                                   else [190, 60, 64, 38]
                                                   end
    kicker_h = (detail_size * 1.9).round
    number_h = (num_size * 1.02).round
    title, title_h = fit(fact.headline, font: :bold, size: title_size, width: text_w, max: (wide? ? 2 : 4) + (fact.plain? ? 1 : 0))
    room = bottom - top - kicker_h - number_h - title_h - (title_size * 0.9).round
    lines = (room / line_height(detail_size)).floor.clamp(0, story? ? 8 : 5)
    detail, detail_h = lines.positive? && fact.subline ? fit(fact.subline, font: :regular, size: detail_size, width: text_w, max: lines) : [nil, 0]
    block = kicker_h + number_h + (title_size * 0.5).round + title_h + (detail ? (title_size * 0.4).round + detail_h : 0)
    y = top + ((bottom - top - block) / 2.0 * (story? ? 0.8 : 0.75)).round.clamp(0, height) # a little above the middle

    args = background
    args += text_block("FUN FACT  ·  #{fact.topic_label.upcase}", font: :semibold, size: (detail_size * 0.78).round, color: accent,
                                                                  width: text_w, height: kicker_h, x: m, y: y)
    y += kicker_h
    number = fact.days.to_fs(:delimited)
    args += ["-fill", ink, "-font", FONTS[:bold], "-pointsize", num_size.to_s, "-kerning", (-num_size * 0.03).round.to_s,
             "-gravity", "NorthWest", "-annotate", "+#{m - (num_size * 0.04).round}+#{y - (num_size * 0.2).round}", number, "-kerning", "0"]
    unit_x = m + text_width(number, font: :bold, size: num_size, kerning: (-num_size * 0.03).round) + (unit_size * 0.3).round
    args += ["-fill", soft_ink, "-font", FONTS[:semibold], "-pointsize", unit_size.to_s,
             "-annotate", "+#{unit_x}+#{y + (num_size * 0.73).round - (unit_size * 0.95).round}", fact.days == 1 ? "day" : "days"]
    y += number_h + (title_size * 0.5).round
    args += text_block(title, font: :bold, size: title_size, color: ink, width: text_w, height: title_h, x: m, y: y)
    y += title_h + (title_size * 0.4).round
    args += text_block(detail, font: :regular, size: detail_size, color: soft_ink, width: text_w, height: detail_h, x: m, y: y) if detail
    args + badge_at(x: wide? ? width - 300 - 36 : m, y: height - 64 - (story? ? 170 : (wide? ? 32 : 84))) + ["-strip", "PNG24:#{out}"]
  end

  # The look's backdrop: a diagonal wash, two soft circles of light, and stars at night (and for space facts)
  def background
    from, to = case look
               when "night" then %w[#0b1020 #1e293b]
               when "paper" then %w[#fdfaf3 #f1e7d3]
               when "sunrise" then %w[#f97316 #db2777]
               else colors.first(2)
               end
    glow = light? ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.07)"
    big = (width * 0.62).round
    args = ["-size", "#{width}x#{height}", "-define", "gradient:angle=135", "gradient:#{from}-#{to}",
            "-fill", glow, "-draw", "circle #{(width * 0.92).round},#{(height * 0.06).round} #{(width * 0.92).round + big},#{(height * 0.06).round}",
            "-fill", glow, "-draw", "circle #{(width * 0.05).round},#{(height * 0.98).round} #{(width * 0.05).round + (big * 0.7).round},#{(height * 0.98).round}"]
    args += stars if look == "night" || (look == "color" && fact.topic == "space")
    shade = light? ? "rgba(0,0,0,0)-rgba(120,90,40,0.08)" : "rgba(0,0,0,0)-rgba(0,0,0,0.28)"
    args + ["(", "-size", "#{width}x#{height}", "gradient:#{shade}", ")", "-composite"]
  end

  # Little stars, in the same places every time for the same fact
  def stars
    rng = Random.new(fact.days)
    (wide? ? 70 : 110).times.flat_map do
      x = rng.rand(width)
      y = rng.rand(height)
      r = [1, 1, 1, 2, 2, 3].sample(random: rng)
      ["-fill", "rgba(255,255,255,#{format('%.2f', 0.25 + rng.rand * 0.5)})", "-draw", "circle #{x},#{y} #{x + r},#{y}"]
    end
  end

  # RecoveryBot: a pill with the mark and the name, white on the dark looks and dark on paper
  def badge_at(x:, y:)
    fill = light? ? "#1c1917" : "white"
    name = light? ? "white" : "#17191c"
    mark = ASSETS.join(light? ? "recoverybot-mark-light.png" : "recoverybot-mark-dark.png").to_s
    w, h = 300, 64
    ["(", "-size", "#{w}x#{h}", "xc:none", "-fill", fill, "-draw", "roundrectangle 0,0 #{w - 1},#{h - 1} 32,32",
     "(", mark, "-resize", "x34", ")", "-gravity", "West", "-geometry", "+24+0", "-composite",
     "-fill", name, "-font", FONTS[:bold], "-pointsize", "30", "-gravity", "West", "-annotate", "+84+0", "RecoveryBot", ")",
     "-gravity", "NorthWest", "-geometry", "+#{x}+#{y}", "-composite"]
  end

  def text_width(value, font:, size:, kerning: 0)
    out, err, status = Open3.capture3(*self.class.magick, "-font", FONTS[font], "-pointsize", size.to_s, "-kerning", kerning.to_s,
                                      "label:#{value}", "-format", "%w", "info:")
    raise Failed, err.to_s.first(500) unless status.success?

    out.to_i
  end
end
