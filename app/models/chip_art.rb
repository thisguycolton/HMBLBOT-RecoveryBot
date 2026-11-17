# The picture on an illustrated chip (ChipDesign emblem "scene"): an SVG someone imports,
# boiled down to layers of outlines so it can be painted (enamel) or struck in metal. Only
# outlines, colors and numbers are kept, never the SVG itself, so nothing in an upload
# (scripts, links, images, styles) can reach anyone's page. Its parsing is ChipRelief's.
#
#   { "view_box" => [x, y, w, h],
#     "layers" => [{ "id", "name", "role", "height", "locked", "shapes" => [{ "id", "d", "t", "fill", "stroke", "sw" }] }] }
#
# Layers go bottom to top, the file's top-level groups (Illustrator and Inkscape layers, Figma
# frames) or "Layer" for shapes outside any. A layer's role says how it's drawn:
#   enamel  painted, each shape its color (and its outline, if it has one, a metal line)
#   line    the metal walls between colors
#   metal   raised bare metal
#   cutout  not drawn: the coin's face shows through
# `height` (0 to 1) is how high it stands when the chip is struck in metal.
module ChipArt
  MAX_SVG = 3.megabytes
  MAX_SHAPES = 3000
  MAX_LAYERS = 40
  MAX_PATH_DATA = 400_000
  ROLES = %w[enamel line metal cutout].freeze
  HEX = /\A#\h{6}\z/
  NAMED = {
    "black" => "#000000", "white" => "#ffffff", "red" => "#ff0000", "green" => "#008000", "blue" => "#0000ff",
    "yellow" => "#ffff00", "orange" => "#ffa500", "purple" => "#800080", "gray" => "#808080", "grey" => "#808080",
    "brown" => "#a52a2a", "gold" => "#ffd700", "silver" => "#c0c0c0", "navy" => "#000080", "teal" => "#008080",
  }.freeze

  class Invalid < StandardError; end

  module_function

  # The art from an uploaded SVG's text, or Invalid with what's wrong
  def from_svg(text)
    raise Invalid, "That file is too big for a chip. Try a simpler SVG." if text.to_s.bytesize > MAX_SVG

    doc = Nokogiri::XML(text.to_s, &:nonet)
    svg = doc.root
    raise Invalid, "That doesn't look like an SVG file." unless svg&.name == "svg"
    raise Invalid, "Pictures (PNG or JPG) can't be painted. Import vector art with filled shapes." if doc.css("image").any? && doc.css("path, polygon, rect, circle, ellipse").none?

    classes = ChipRelief.css_fills(doc)
    strokes = css_strokes(doc)
    stops = gradient_colors(doc)
    layers = []
    loose = []
    svg.element_children.each do |el|
      next if ChipRelief::SKIP.include?(el.name)

      if el.name == "g"
        shapes = []
        walk(el, el["transform"].to_s, paint(el, classes, strokes, stops), classes, strokes, stops, shapes)
        layers << { "name" => layer_name(el, layers.size), "shapes" => shapes } if shapes.any?
      else
        walk_one(el, "", {}, classes, strokes, stops, loose)
      end
    end
    layers.unshift({ "name" => "Layer", "shapes" => loose }) if loose.any?
    raise Invalid, "We couldn't find any shapes in that SVG. Outline any text first (in Illustrator: Type > Create Outlines)." if layers.empty?

    n = 0
    layers = layers.each_with_index.map do |layer, i|
      shapes = layer["shapes"].map { |s| s.merge("id" => "s#{n += 1}") }
      lines = shapes.all? { |s| s["fill"].nil? }
      { "id" => "l#{i + 1}", "name" => layer["name"], "role" => lines ? "line" : "enamel",
        "height" => lines ? 1.0 : (0.2 + 0.8 * i / [layers.size - 1, 1].max).round(2), "locked" => false, "shapes" => shapes }
    end
    clean("view_box" => ChipRelief.view_box(svg), "layers" => layers) || raise(Invalid, "That SVG is too detailed for a chip. Try a simpler one.")
  end

  # Art as stored and sent: checked again on every save, so only good outlines get through
  def clean(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    return nil unless raw.is_a?(Hash)

    raw = raw.deep_stringify_keys
    box = Array(raw["view_box"]).first(4).map { |v| Float(v, exception: false) }
    return nil unless box.size == 4 && box.all? && box[2].positive? && box[3].positive?

    count = 0
    data = 0
    ids = {}
    layers = Array(raw["layers"]).first(MAX_LAYERS).each_with_index.filter_map do |layer, i|
      next unless layer.is_a?(Hash)

      shapes = Array(layer["shapes"]).filter_map do |s|
        next unless s.is_a?(Hash) && s["d"].is_a?(String) && s["d"].present? && s["d"].match?(ChipRelief::PATH_DATA)
        next if (count += 1) > MAX_SHAPES

        data += s["d"].size
        id = s["id"].to_s[/\A[\w-]{1,24}\z/] || "s#{count}"
        id = "s#{count}x" if ids[id]
        ids[id] = true
        t = s["t"].to_s
        { "id" => id, "d" => s["d"].squish, "t" => (t.squish if t.present? && t.match?(ChipRelief::TRANSFORM)),
          "fill" => color(s["fill"]), "stroke" => color(s["stroke"]),
          "sw" => (Float(s["sw"], exception: false)&.clamp(0.0, 50.0)&.round(2) if s["stroke"]) }.compact
      end
      next if shapes.empty?

      { "id" => layer["id"].to_s[/\A[\w-]{1,24}\z/] || "l#{i + 1}", "name" => layer["name"].to_s.squish.first(40).presence || "Layer #{i + 1}",
        "role" => ROLES.include?(layer["role"]) ? layer["role"] : "enamel",
        "height" => Float(layer["height"], exception: false)&.clamp(0.0, 1.0)&.round(2) || 0.5,
        "locked" => ActiveModel::Type::Boolean.new.cast(layer["locked"]) || false, "shapes" => shapes }
    end
    return nil if layers.empty? || data > MAX_PATH_DATA

    { "view_box" => box.map { |v| v.round(3) }, "layers" => layers }
  end

  # The colors its enamel shapes are painted, most used first
  def colors(art)
    Array(art&.dig("layers")).select { |l| l["role"] == "enamel" }.flat_map { |l| l["shapes"].filter_map { |s| s["fill"] } }.tally.sort_by { |_, n| -n }.map(&:first)
  end

  # Named palettes: { "Winter night" => { "#9fd0ee" => "#1c2a55", ... } }, only for colors in the art
  def clean_palettes(raw, art)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    return {} unless raw.is_a?(Hash)

    used = colors(art)
    raw.first(8).to_h do |name, map|
      map = map.is_a?(Hash) ? map.to_h { |from, to| [color(from), color(to)] }.select { |from, to| used.include?(from) && to } : {}
      [name.to_s.squish.first(30), map]
    end.reject { |name, _| name.blank? }
  end

  def color(value)
    v = value.to_s.strip.downcase
    return nil if v.empty? || v == "none" || v == "transparent"
    return v if v.match?(HEX)
    return "##{v[1] * 2}#{v[2] * 2}#{v[3] * 2}" if v.match?(/\A#\h{3}\z/)
    return "#%02x%02x%02x" % [$1, $2, $3].map { |c| c.to_i.clamp(0, 255) } if v =~ /\Argba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/

    NAMED[v]
  end

  def layer_name(el, i)
    label = el.attribute_with_ns("label", "http://www.inkscape.org/namespaces/inkscape")&.value
    (label || el["data-name"] || el["id"]&.tr("_-", "  ")).to_s.squish.first(40).presence || "Layer #{i + 1}"
  end

  def walk(node, transform, inherited, classes, strokes, stops, out)
    node.element_children.each { |el| walk_one(el, transform, inherited, classes, strokes, stops, out) }
  end

  def walk_one(el, transform, inherited, classes, strokes, stops, out)
    return if ChipRelief::SKIP.include?(el.name)
    return if (ChipRelief.style(el)["display"] || el["display"]) == "none"

    t = [transform, el["transform"].to_s].join(" ").strip
    p = inherited.merge(paint(el, classes, strokes, stops))
    if %w[g a svg].include?(el.name)
      walk(el, t, p, classes, strokes, stops, out)
    elsif ChipRelief::SHAPES.include?(el.name) || el.name == "line"
      d = el.name == "line" ? "M#{ChipRelief.num(el, 'x1')} #{ChipRelief.num(el, 'y1')} L#{ChipRelief.num(el, 'x2')} #{ChipRelief.num(el, 'y2')}" : ChipRelief.outline(el)
      fill = p.key?("fill") ? p["fill"] : (%w[polyline line].include?(el.name) ? nil : "#000000")
      return unless d && (fill || p["stroke"])

      out << { "d" => d, "t" => t.presence, "fill" => fill, "stroke" => p["stroke"], "sw" => p["sw"] || (1.0 if p["stroke"]) }.compact
    end
  end

  # What an element sets: fill (nil for none), stroke and its width
  def paint(el, classes, strokes, stops)
    style = ChipRelief.style(el)
    out = {}
    fill = style["fill"] || el["fill"] || el["class"].to_s.split.filter_map { |c| classes[c] }.last
    out["fill"] = resolve(fill, stops) if fill
    stroke = style["stroke"] || el["stroke"] || el["class"].to_s.split.filter_map { |c| strokes[c] }.last
    out["stroke"] = resolve(stroke, stops) if stroke
    width = style["stroke-width"] || el["stroke-width"]
    out["sw"] = width.to_s[/[\d.]+/].to_f if width.present?
    out
  end

  # A gradient (url(#id)) paints as its first stop's color
  def resolve(value, stops)
    v = value.to_s.strip
    return stops[$1] || "#888888" if v =~ /\Aurl\(\s*['"]?#([^)'"]+)['"]?\s*\)/

    color(v)
  end

  def gradient_colors(doc)
    doc.css("linearGradient, radialGradient").each_with_object({}) do |g, out|
      stop = g.css("stop").first
      c = stop && (ChipRelief.style(stop)["stop-color"] || stop["stop-color"])
      out[g["id"]] = color(c) || "#888888" if g["id"]
    end
  end

  def css_strokes(doc)
    doc.css("style").map(&:text).join("\n").scan(/([^{}]+)\{([^}]*)\}/).each_with_object({}) do |(selectors, body), out|
      stroke = body[/(?:^|;)\s*stroke\s*:\s*([^;]+)/, 1]&.strip
      next unless stroke

      selectors.split(",").each { |s| out[s.strip.delete_prefix(".")] = stroke if s.strip.match?(/\A\.[\w-]+\z/) }
    end
  end
end
