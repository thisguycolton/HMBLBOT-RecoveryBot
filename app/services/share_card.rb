# The picture a link shows when it's shared (og:image): 1200×630 PNGs drawn with ImageMagick,
# with the RecoveryBot mark in the bottom right corner.
#   page    - a document or reading: a sheet of paper with its title and group (and the start of its text)
#   flyer   - an event or meeting: its name, when it is and the group, on the cover (or the site's blue)
#   group   - a group: its logo and name on its cover
#   site    - RecoveryBot itself, for every other page
# Cards are kept in tmp/share_cards under a key made of everything drawn on them, so an edit
# draws a new one and an unchanged one is drawn once.
class ShareCard
  VERSION = 2
  WIDTH = 1200
  HEIGHT = 630
  ASSETS = Rails.root.join("lib/share_cards")
  FONTS = { regular: "PublicSans_400Regular.ttf", semibold: "PublicSans_600SemiBold.ttf", bold: "PublicSans_800ExtraBold.ttf" }.transform_values { |f| ASSETS.join(f).to_s }
  DIR = Rails.root.join("tmp/share_cards")
  IMAGE_TYPES = %w[image/png image/jpeg image/webp image/gif].freeze
  BLUE = %w[#2f6fd6 #3b4fc4].freeze

  class Failed < StandardError; end

  attr_reader :style, :title, :subtitle, :kicker, :text, :logo, :cover

  # style: :page, :flyer, :group or :site. logo/cover: Active Storage attachments (or nil).
  def initialize(style:, title:, subtitle: nil, kicker: nil, text: nil, logo: nil, cover: nil)
    @style = style
    @title = clean(title).truncate(style == :page ? 110 : 90)
    @subtitle = clean(subtitle).truncate(style == :page ? 140 : 80).presence
    @kicker = clean(kicker).truncate(60).presence
    @text = clean(text).truncate(260).presence
    @logo = picture(logo)
    @cover = picture(cover)
  end

  def self.for(record)
    case record
    when GroupDocument
      new(style: :page, title: record.title, kicker: record.group.title, text: record.summary, logo: record.group.logo)
    when Reading
      new(style: :page, title: record.title.presence || record.meetingName, kicker: record.group&.title || "Meeting reading", subtitle: record.source,
          text: record.share_excerpt, logo: record.group&.logo)
    when Event
      new(style: :flyer, title: record.title.presence || "Event", subtitle: record.when_label || "Date to be decided",
          kicker: record.group.title, cover: record.cover.attached? ? record.cover : record.group.cover)
    when Meeting
      new(style: :flyer, title: record.name, subtitle: record.share_schedule_label, kicker: record.group.title,
          logo: record.group.logo, cover: record.group.cover)
    when OiaaMeeting
      new(style: :flyer, title: record.name, subtitle: record.schedule_label,
          kicker: [record.group_name.presence, "AA Intergroup"].compact.uniq.join(" · "))
    when Group
      new(style: :group, title: record.title, subtitle: record.description, logo: record.logo, cover: record.cover)
    else
      site
    end
  end

  def self.site = new(style: :site, title: "RecoveryBot", subtitle: "Meetings, readings and tools for recovery groups")

  # The PNG's path, drawn now if it isn't there yet
  def path
    file = DIR.join("#{key}.png")
    return file if file.exist?

    FileUtils.mkdir_p(DIR)
    Dir.mktmpdir("share-card") do |dir|
      out = File.join(dir, "card.png")
      begin
        run(command(dir, out))
      rescue Failed
        # A logo or cover ImageMagick can't read: the card without them
        raise unless logo || cover

        @logo = @cover = nil
        run(command(dir, out))
      end
      FileUtils.mv(out, file)
    end
    file
  end

  def key
    Digest::SHA256.hexdigest([VERSION, style, title, subtitle, kicker, text, logo&.key, cover&.key].to_json).first(32)
  end

  private

  def clean(value) = value.to_s.gsub(/[[:cntrl:]]/, " ").squish

  # An attached picture (or a blob) we can draw, as its blob, or nil
  def picture(attachment)
    blob = attachment.respond_to?(:attached?) ? (attachment.blob if attachment.attached?) : attachment
    blob if blob && IMAGE_TYPES.include?(blob.content_type) && blob.byte_size < 15.megabytes
  end

  def run(args)
    _out, err, status = Open3.capture3(*self.class.magick, *args)
    raise Failed, err.to_s.first(500) unless status.success?
  end

  # ImageMagick 7 is `magick`; the 6 in Debian's images is `convert`
  def self.magick
    @magick ||= system("magick", "-version", out: File::NULL, err: File::NULL) ? ["magick"] : ["convert"]
  end

  # Text for caption:, which reads "@file" and expands "%x" and "\n" otherwise
  def caption(value) = "caption:#{value.gsub('\\') { '\\\\' }.gsub('%', '%%').sub(/\A@/) { '\\@' }}"

  def fetch(blob, dir)
    file = File.join(dir, "#{blob.key}#{File.extname(blob.filename.to_s).downcase.presence || '.img'}")
    File.binwrite(file, blob.download) unless File.exist?(file)
    "#{file}[0]"
  end

  # One block of wrapped text, `width` wide, laid on the canvas at x,y (top left)
  def text_block(value, font:, size:, color:, width:, height:, x:, y:, gravity: "NorthWest")
    ["(", "-size", "#{width}x#{height}", "-background", "none", "-fill", color, "-font", FONTS[font],
     "-pointsize", size.to_s, "-interline-spacing", (-size * 0.12).round.to_s, "-gravity", gravity, caption(value), ")",
     "-gravity", "NorthWest", "-geometry", "+#{x}+#{y}", "-composite"]
  end

  # A picture cut to a rounded square of `size`, laid at x,y; on white, so logos with
  # see-through backgrounds read on any cover
  def rounded(file, size:, x:, y:, radius: (size * 0.22).round, pad: 0)
    inner = size - (pad * 2)
    ["(", "-size", "#{size}x#{size}", "xc:white",
     "(", file, "-auto-orient", "-resize", "#{inner}x#{inner}^", "-gravity", "center", "-extent", "#{inner}x#{inner}", ")",
     "-gravity", "center", "-composite",
     "(", "-size", "#{size}x#{size}", "xc:none", "-fill", "white", "-draw", "roundrectangle 0,0 #{size - 1},#{size - 1} #{radius},#{radius}", ")",
     "-alpha", "set", "-compose", "DstIn", "-composite", "-compose", "Over", ")",
     "-gravity", "NorthWest", "-geometry", "+#{x}+#{y}", "-composite"]
  end

  # The background: the cover, darkened towards the bottom, or the site's blue
  def backdrop(dir)
    if cover
      ["(", fetch(cover, dir), "-auto-orient", "-resize", "#{WIDTH}x#{HEIGHT}^", "-gravity", "center", "-extent", "#{WIDTH}x#{HEIGHT}", ")",
       "(", "-size", "#{WIDTH}x#{HEIGHT}", "gradient:rgba(0,0,0,0.25)-rgba(0,0,0,0.85)", ")", "-composite"]
    else
      ["-size", "#{WIDTH}x#{HEIGHT}", "-define", "gradient:angle=135", "gradient:#{BLUE.join('-')}",
       "(", "-size", "#{WIDTH}x#{HEIGHT}", "gradient:rgba(0,0,0,0)-rgba(0,0,0,0.35)", ")", "-composite"]
    end
  end

  # RecoveryBot in the bottom right: a white pill with the mark and the name
  def badge(light: true)
    fill = light ? "white" : "#17191c"
    ink = light ? "#17191c" : "white"
    mark = ASSETS.join(light ? "recoverybot-mark-dark.png" : "recoverybot-mark-light.png").to_s
    w, h = 300, 64
    x, y = WIDTH - w - 36, HEIGHT - h - 32
    ["(", "-size", "#{w}x#{h}", "xc:none", "-fill", fill, "-draw", "roundrectangle 0,0 #{w - 1},#{h - 1} 32,32",
     "(", mark, "-resize", "x34", ")", "-gravity", "West", "-geometry", "+24+0", "-composite",
     "-fill", ink, "-font", FONTS[:bold], "-pointsize", "30", "-gravity", "West", "-annotate", "+84+0", "RecoveryBot", ")",
     "-gravity", "NorthWest", "-geometry", "+#{x}+#{y}", "-composite"]
  end

  def command(dir, out)
    send(:"#{style}_command", dir) + ["-strip", "PNG24:#{out}"]
  end

  # `value` wrapped at `width` the way caption: will, cut short with "…" past `max` lines:
  # [the text, its height]
  def fit(value, font:, size:, width:, max:)
    limit = max * line_height(size) + (size / 3)
    3.times do
      height = measure(value, font: font, size: size, width: width)
      return [value, height] if height <= limit

      value = "#{value.first((value.size * limit / height.to_f * 0.95).floor).sub(/\s+\S*\z/, '')}…"
    end
    [value, limit]
  end

  def measure(value, font:, size:, width:)
    out, err, status = Open3.capture3(*self.class.magick, "-size", "#{width}x", "-font", FONTS[font], "-pointsize", size.to_s,
                                      "-interline-spacing", (-size * 0.12).round.to_s, caption(value), "-format", "%h", "info:")
    raise Failed, err.to_s.first(500) unless status.success?

    out.to_i
  end

  def line_height(size) = (size * 1.12).round

  # A sheet of paper rising from the bottom, on a soft grey desk
  def page_command(dir)
    sheet_x, sheet_y, sheet_w = 90, 56, WIDTH - 180
    args = ["-size", "#{WIDTH}x#{HEIGHT}", "gradient:#dfe5ee-#c3ccd9",
            "-fill", "rgba(15,23,42,0.10)", "-draw", "roundrectangle #{sheet_x + 6},#{sheet_y + 10} #{sheet_x + sheet_w + 6},#{HEIGHT + 40} 26,26",
            "-fill", "white", "-draw", "roundrectangle #{sheet_x},#{sheet_y} #{sheet_x + sheet_w},#{HEIGHT + 40} 26,26"]
    left = sheet_x + 64
    width = sheet_w - 128
    y = sheet_y + 52
    if logo
      args += rounded(fetch(logo, dir), size: 64, x: left, y: y - 6)
      args += text_block(kicker.to_s.upcase, font: :semibold, size: 26, color: "#2f6fd6", width: width - 84, height: 40, x: left + 84, y: y + 10)
    elsif kicker
      args += text_block(kicker.upcase, font: :semibold, size: 26, color: "#2f6fd6", width: width, height: 40, x: left, y: y + 4)
    end
    y += 92
    name, title_h = fit(title, font: :bold, size: 60, width: width, max: 3)
    args += text_block(name, font: :bold, size: 60, color: "#0f172a", width: width, height: title_h, x: left, y: y)
    y += title_h + 18
    if subtitle
      # a long source ("AA Grapevine | NAME | COUNTY, REGION") takes two lines
      sub, sub_h = fit(subtitle, font: :semibold, size: 30, width: width, max: 2)
      args += text_block(sub, font: :semibold, size: 30, color: "#475569", width: width, height: sub_h, x: left, y: y)
      y += sub_h + 16
    end
    if text && y < HEIGHT - 90
      args += text_block(text, font: :regular, size: 28, color: "#64748b", width: width, height: HEIGHT - y, x: left, y: y)
      args += ["(", "-size", "#{sheet_w}x150", "gradient:rgba(255,255,255,0)-white", ")", "-gravity", "NorthWest", "-geometry", "+#{sheet_x}+#{HEIGHT - 150}", "-composite"]
    end
    args + badge(light: false)
  end

  # An event or meeting: the group's logo (meetings), the group, the name and when, from the bottom up
  def flyer_command(dir)
    args = backdrop(dir)
    left = 72
    width = WIDTH - 2 * left
    args += rounded(fetch(logo, dir), size: 128, x: left, y: 64) if logo
    y = HEIGHT - 64
    if subtitle
      line, sub_h = fit(subtitle, font: :semibold, size: 34, width: width - 340, max: 2)
      y -= sub_h
      args += text_block(line, font: :semibold, size: 34, color: "white", width: width - 340, height: sub_h, x: left, y: y)
      y -= 16
    end
    room = ((y - (logo ? 64 + 128 + 70 : 120)) / line_height(70)).clamp(1, 3)
    name, title_h = fit(title, font: :bold, size: 70, width: width, max: room)
    y -= title_h
    args += text_block(name, font: :bold, size: 70, color: "white", width: width, height: title_h, x: left, y: y)
    args += text_block(kicker.upcase, font: :semibold, size: 28, color: "rgba(255,255,255,0.9)", width: width, height: 42, x: left, y: y - 50) if kicker
    args + badge
  end

  # A group: its logo big, its name (and description) beside it
  def group_command(dir)
    args = backdrop(dir)
    left = 80
    if logo
      args += rounded(fetch(logo, dir), size: 260, x: left, y: (HEIGHT - 260) / 2 - 30)
      left += 260 + 56
    end
    width = WIDTH - left - 80
    name, title_h = fit(title, font: :bold, size: 72, width: width, max: 3)
    about, sub_h = subtitle ? fit(subtitle, font: :regular, size: 30, width: width, max: 3) : [nil, 0]
    y = ((HEIGHT - 60 - title_h - (about ? sub_h + 20 : 0)) / 2).clamp(40, HEIGHT)
    args += text_block(name, font: :bold, size: 72, color: "white", width: width, height: title_h, x: left, y: y)
    args += text_block(about, font: :regular, size: 30, color: "rgba(255,255,255,0.88)", width: width, height: sub_h, x: left, y: y + title_h + 20) if about
    args + badge
  end

  # RecoveryBot: the mark, the name and what it is
  def site_command(_dir)
    args = backdrop(nil)
    args += ["(", ASSETS.join("recoverybot-mark-light.png").to_s, "-resize", "x220", ")", "-gravity", "NorthWest", "-geometry", "+90+205", "-composite"]
    args += ["-fill", "white", "-font", FONTS[:bold], "-pointsize", "96", "-gravity", "NorthWest", "-annotate", "+400+210", "RecoveryBot"]
    args + text_block(subtitle, font: :regular, size: 36, color: "rgba(255,255,255,0.9)", width: 700, height: 100, x: 404, y: 340)
  end
end
