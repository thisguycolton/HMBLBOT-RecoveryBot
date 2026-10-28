# A group's logo as a raised relief on its round chips (ChipDesign emblem "relief"): an SVG the
# group uploads, boiled down to its filled shapes as path outlines, each with a height from its
# color (dark is raised, light is low, white cuts back down to the face), so the chip can light it
# like a heightmap (Chip.jsx). Only outlines and numbers are kept, never the SVG itself, so
# nothing in an upload (scripts, links, images, styles) can reach anyone's page.
module ChipRelief
  MAX_SVG = 2.megabytes
  MAX_SHAPES = 400
  MAX_PATH_DATA = 80_000
  PATH_DATA = /\A[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*\z/
  TRANSFORM = /\A(\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\([0-9eE.,\s+-]*\)\s*,?)*\s*\z/
  SHAPES = %w[path polygon polyline rect circle ellipse].freeze
  SKIP = %w[defs clipPath mask pattern symbol marker style title desc metadata linearGradient radialGradient filter text].freeze

  class Invalid < StandardError; end

  module_function

  # The relief from an uploaded SVG's text, or Invalid with what's wrong
  def from_svg(text)
    raise Invalid, "That file is too big for a chip. Try a simpler SVG." if text.to_s.bytesize > MAX_SVG

    doc = Nokogiri::XML(text.to_s, &:nonet) # no network, no entity expansion
    svg = doc.root
    raise Invalid, "That doesn't look like an SVG file." unless svg&.name == "svg"

    classes = css_fills(doc)
    shapes = []
    walk(svg, "", nil, classes, shapes)
    raise Invalid, "We couldn't find any filled shapes in that SVG. Outline any text first (in Illustrator: Type > Create Outlines)." if shapes.empty?

    clean("view_box" => view_box(svg), "shapes" => shapes) || raise(Invalid, "That SVG is too detailed for a chip. Try a simpler one.")
  end

  # A relief as stored and sent: checked again on every save, so only good outlines get through
  def clean(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    return nil unless raw.is_a?(Hash)

    raw = raw.deep_stringify_keys
    box = Array(raw["view_box"]).first(4).map { |n| Float(n, exception: false) }
    return nil unless box.size == 4 && box.all? && box[2].positive? && box[3].positive?

    shapes = Array(raw["shapes"]).first(MAX_SHAPES).filter_map do |s|
      next unless s.is_a?(Hash) && s["d"].is_a?(String) && s["d"].match?(PATH_DATA) && s["d"].present?

      t = s["t"].to_s
      { "d" => s["d"].squish, "h" => Float(s["h"], exception: false)&.clamp(0.0, 1.0)&.round(2) || 1.0, "t" => (t.squish if t.present? && t.match?(TRANSFORM)) }.compact
    end
    return nil if shapes.empty? || shapes.sum { |s| s["d"].size } > MAX_PATH_DATA

    { "view_box" => box.map { |n| n.round(3) }, "shapes" => shapes }
  end

  def walk(node, transform, fill, classes, out)
    node.element_children.each do |el|
      next if SKIP.include?(el.name)
      next if (style(el)["display"] || el["display"]) == "none"

      t = [transform, el["transform"].to_s].join(" ").strip
      f = fill_of(el, classes) || fill
      if el.name == "g" || el.name == "a" || el.name == "svg"
        walk(el, t, f, classes, out)
      elsif SHAPES.include?(el.name)
        d = outline(el)
        h = height(f || "#000")
        out << { "d" => d, "h" => h, "t" => t.presence } if d && h
      end
    end
  end

  def style(el) = el["style"].to_s.split(";").to_h { |pair| pair.split(":", 2).map(&:strip) }.reject { |k, _| k.blank? }

  # Simple `.name { fill: … }` rules from <style> (what Illustrator writes)
  def css_fills(doc)
    doc.css("style").map(&:text).join("\n").scan(/([^{}]+)\{([^}]*)\}/).each_with_object({}) do |(selectors, body), out|
      fill = body[/(?:^|;)\s*fill\s*:\s*([^;]+)/, 1]&.strip
      next unless fill

      selectors.split(",").each { |s| out[s.strip.delete_prefix(".")] = fill if s.strip.match?(/\A\.[\w-]+\z/) }
    end
  end

  def fill_of(el, classes)
    style(el)["fill"] || el["fill"] || el["class"].to_s.split.filter_map { |c| classes[c] }.last
  end

  # How high a fill stands: 1 for black, down to 0 for white; nil for none (not drawn)
  def height(fill)
    fill = fill.to_s.strip.downcase
    return nil if fill == "none" || fill == "transparent"

    rgb = case fill
          when /\A#(\h)(\h)(\h)\z/ then [$1, $2, $3].map { |c| (c * 2).to_i(16) }
          when /\A#(\h{2})(\h{2})(\h{2})/ then [$1, $2, $3].map { |c| c.to_i(16) }
          when /\Argba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/ then [$1, $2, $3].map(&:to_i)
          when "white" then [255, 255, 255]
          else [0, 0, 0] # named colors, gradients (url(...)), currentColor: raised
          end
    lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255.0
    (1 - lum).round(2)
  end

  def num(el, attr) = el[attr].to_s[/-?[\d.]+(?:e-?\d+)?/i].to_f

  # A shape's outline as path data
  def outline(el)
    case el.name
    when "path" then el["d"].to_s.presence
    when "polygon", "polyline"
      pts = el["points"].to_s.scan(/-?[\d.]+(?:e-?\d+)?/i)
      "M#{pts.each_slice(2).map { |p| p.join(' ') }.join(' L')} Z" if pts.size >= 6
    when "rect"
      x, y, w, h = num(el, "x"), num(el, "y"), num(el, "width"), num(el, "height")
      "M#{x} #{y} h#{w} v#{h} h#{-w} Z" if w.positive? && h.positive?
    when "circle", "ellipse"
      cx, cy = num(el, "cx"), num(el, "cy")
      rx = el.name == "circle" ? num(el, "r") : num(el, "rx")
      ry = el.name == "circle" ? rx : num(el, "ry")
      "M#{cx - rx} #{cy} a#{rx} #{ry} 0 1 0 #{rx * 2} 0 a#{rx} #{ry} 0 1 0 #{-rx * 2} 0 Z" if rx.positive? && ry.positive?
    end
  end

  def view_box(svg)
    box = svg["viewBox"].to_s.split(/[\s,]+/).map { |n| Float(n, exception: false) }
    return box if box.size == 4 && box.all?

    [0, 0, num(svg, "width").nonzero? || 100, num(svg, "height").nonzero? || 100]
  end
end
