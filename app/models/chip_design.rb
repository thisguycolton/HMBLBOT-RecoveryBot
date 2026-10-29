# How chips look. DEFAULT is RecoveryBot's own, plain design, for every chip a member earns. A
# group can design its own (groups.chip_design, Group dashboard > Chips) for the chips its hosts
# give (ChipAward), and Meeting Maker chips: the "meeting" part of the group's design is the
# default for all its meetings, and a meeting can change it (meetings.chip_design, the meeting
# part only). Only what differs from the default is stored, so the rest follows it.
#
# The "scene" emblem puts a chip template's art (ChipTemplate, made in the chip art editor) on
# the face: `scene` names the template and the version it was picked at, the palette, the
# finish (enamel: painted; struck: one metal, lit from its layers' heights), the metal, and the
# group's own changes (bucket fills by shape, hidden layers, layer heights). Designs sent out
# are resolved (resolve): the version's art and the palette's colors come along.
#
# Round and Meeting Maker chips can look different at each milestone (`milestones`, by
# milestone key: "30d", "year" for every year, "5y" for one year, "n10" for 10 meetings, "n+"
# for every hundred after 100): their color and finish, and with a scene its palette, enamel or
# struck, metal, body (metal or colored plastic) and bucket fills. A template can set the scene's per milestone too (its
# defaults' `milestones`, sent with the art as `template_milestones`); the group's win.
# Chip.jsx atMilestone draws them.
module ChipDesign
  ROUND_KEYS = %w[24h 30d 60d 90d 6m 9m 18m year].freeze
  EMBLEMS = %w[triangle logo relief none scene].freeze
  SCENE_FINISHES = %w[enamel struck].freeze
  # Struck and the lines of enamel: the metal and, for black and gold, the dark of its recesses
  METALS = { "brass" => "#c9a24a", "silver" => "#c4cad3", "bronze" => "#a86b3c", "black_gold" => "#d4af37" }.freeze
  MILESTONE_SPOTS = %w[badge cartouche rim none].freeze
  EDGES = %w[plain reeded rope beads].freeze
  FINISHES = %w[classic metal plastic].freeze
  NUMERALS = %w[roman number].freeze
  TRIANGLE_FINISHES = %w[metal plastic].freeze
  SHAPES = %w[triangle round].freeze
  MEETING_EMBLEMS = %w[number scene].freeze
  # A milestone's own look: which keys a part takes (round: ROUND_KEYS or "Ny" years; meeting:
  # "nN" counts or "n+"), and what can change
  MILESTONE_KEYS = {
    "round" => ->(k) { ROUND_KEYS.include?(k) || k.match?(/\A[1-9]\d?y\z/) },
    "meeting" => ->(k) { k == "n+" || k.match?(/\An[1-9]\d{0,4}\z/) },
  }.freeze
  SCENE_LOOK_KEYS = %w[palette art_finish metal body fills].freeze
  BODIES = %w[metal colored].freeze

  DEFAULT = {
    "round" => {
      "top_text" => "To thine own self be true",
      "bottom_text" => "Unity · Service · Recovery",
      # On the back, line by line
      "back_text" => "God grant me\nthe serenity\nto accept the things\nI cannot change,\ncourage to change\nthe things I can,\nand wisdom to know\nthe difference.",
      "emblem" => "triangle",
      "numerals" => "roman",
      # The raised logo ("relief" emblem): how wide it is (of the 200 across the chip) and, on
      # metal chips, how high it stands and how sharply it rises from the coin, 1 to 10
      "relief_depth" => "raised", # or "inset", cut into the coin
      "relief_size" => 64,
      "relief_badge" => false, # a circle over its middle with the milestone in it
      "relief_height" => 4,
      "relief_sharpness" => 7,
      # A scene: where the milestone goes on the art, and words around the back's rim (the
      # group's name and the day it was earned when blank)
      "milestone_at" => "badge",
      "back_ring_top" => "",
      "back_ring_bottom" => "",
      # The rim's edge, any emblem
      "edge" => "plain",
      # classic: colored chips for the months, metal medallions for the years
      "finish" => "classic",
      "colors" => {
        "24h" => "#c3c9d2", "30d" => "#c62839", "60d" => "#d9a31e", "90d" => "#1d8a4b",
        "6m" => "#2356b8", "9m" => "#6c3fa8", "18m" => "#0d8789", "year" => "#a66d37",
      },
    },
    "triangle" => {
      "sides" => ["Unity", "Service", "Recovery"],
      "finish" => "plastic",
      "colors" => { "inventory" => "#3451b2", "gratitude" => "#d9480f", "meeting" => "#0f766e" },
    },
    # Meeting Maker chips: a triangle (or round) chip with the count, "Meeting Maker" and the
    # meeting's name around it (a blank third side is the meeting's name), in a color or with a
    # template's art (emblem "scene")
    "meeting" => {
      "shape" => "triangle",
      "emblem" => "number",
      "sides" => ["Meeting", "Maker", ""],
      "back_text" => "One day at a time",
      "finish" => "plastic",
      "color" => "#0f766e",
      "milestone_at" => "badge",
      "edge" => "plain",
    },
  }.freeze
  TRIANGLE_KINDS = DEFAULT["triangle"]["colors"].keys.freeze

  module_function

  def for_group(group) = resolve(merge(group&.chip_design))

  # RecoveryBot's own sobriety chips, the ones members earn: DEFAULT until a site admin designs
  # them (Site Admin > Chip design, round chips only). Each change is kept (ChipDesignVersion
  # "Site"), so an earned chip looks as they did on the day it was earned (for_site_on).
  def for_site = ChipDesignVersion.site.order(:created_at, :id).last&.design || DEFAULT

  def site_versions = ChipDesignVersion.site.order(:created_at, :id).to_a

  # How earned chips looked at the end of `date` (`versions` from site_versions), or nil while
  # they've never been changed
  def for_site_on(date, versions)
    versions.reverse.find { |v| v.created_at <= date.end_of_day }&.design
  end

  # Saves a new look for them from now on: only the round part, the rest stays RecoveryBot's
  def save_site!(stored)
    round = pin(stored)["round"]
    design = resolve(merge(round.present? ? { "round" => round } : nil))
    before = for_site
    ChipDesignVersion.record(:site, design, before: before) if design != before
    design
  end

  # A meeting's Meeting Maker chips: its group's default with the meeting's own changes, and
  # the meeting's name along the third side unless that was given
  def for_meeting(meeting)
    design = merge("meeting" => meeting_part(meeting))
    sides = design["meeting"]["sides"]
    design["meeting"]["sides"] = [sides[0], sides[1], sides[2].presence || meeting.name.to_s.first(24)]
    resolve(design)
  end

  # What a meeting's chips change from RecoveryBot's: the group's default, then the meeting's own
  def meeting_part(meeting)
    (normalize(meeting.group&.chip_design)["meeting"] || {}).merge(normalize(meeting.chip_design)["meeting"] || {})
  end

  # How a meeting's chips looked on `date` (minted chips never change), or now
  def for_meeting_on(meeting, date, versions = nil)
    versions ||= ChipDesignVersion.where(owner_type: "Meeting", owner_id: meeting.id).order(:created_at, :id).to_a
    versions.reverse.find { |v| v.created_at <= date.end_of_day }&.design || for_meeting(meeting)
  end

  # The design with its scene's art and palette colors put in, ready to draw; a scene whose
  # template is gone or hidden draws as the circle and triangle. Already resolved: left as is.
  def resolve(design)
    design.each_value do |part|
      next unless part.is_a?(Hash) && part["emblem"] == "scene" && part["scene"].is_a?(Hash) && !part["scene"]["art"]

      scene = part["scene"]
      template = ChipTemplate.where(status: "published", hidden: false).find_by(id: scene["template_id"])
      version = template && (template.versions.find_by(number: scene["version"]) || template.latest)
      if version
        palette = scene["palette"].presence || version.defaults["palette"]
        part["scene"] = scene.merge("version" => version.number, "title" => template.title, "art" => version.art,
                                    "colors" => version.palettes[palette] || {}, "palettes" => version.palettes, "latest" => template.latest.number,
                                    "template_layout" => version.defaults["layout"],
                                    "template_milestones" => version.defaults["milestones"]).compact
      else
        part["emblem"] = part.key?("shape") ? "number" : "triangle"
      end
    end
    design
  end

  # A scene with no version picked gets its template's latest, so it stays as it was chosen
  def pin(stored)
    stored = normalize(stored)
    %w[round meeting].each do |part|
      scene = stored.dig(part, "scene")
      next unless scene && !scene["version"]

      scene["version"] = ChipTemplate.find_by(id: scene["template_id"])&.latest&.number
      scene.compact!
    end
    stored
  end

  def meeting_sides(meeting) = ["Meeting", "Maker", meeting.name.to_s.first(24)]

  # Meeting designs saved before the meeting part: their triangle's sides, finish and color
  def legacy(raw)
    return raw unless raw.is_a?(Hash) && raw["triangle"].is_a?(Hash) && !raw.key?("meeting")

    t = raw["triangle"]
    raw.merge("meeting" => { "sides" => t["sides"], "finish" => t["finish"], "color" => t.dig("colors", "meeting") }.compact)
  end

  # The stored design laid over the default
  def merge(stored)
    stored = normalize(stored)
    DEFAULT.to_h do |part, defaults|
      given = stored[part] || {}
      merged = defaults.merge(given.except("colors"))
      merged["colors"] = defaults["colors"].merge(given["colors"] || {}) if defaults["colors"]
      [part, merged]
    end
  end

  # Only known keys and good values, and only where they differ from the default
  def normalize(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    raw = legacy(raw.is_a?(Hash) ? raw.deep_stringify_keys : {})
    round = raw["round"].is_a?(Hash) ? raw["round"] : {}
    triangle = raw["triangle"].is_a?(Hash) ? raw["triangle"] : {}
    meeting = raw["meeting"].is_a?(Hash) ? raw["meeting"] : {}
    out = {
      "round" => {
        "top_text" => text(round["top_text"]),
        "bottom_text" => text(round["bottom_text"]),
        "back_text" => back(round["back_text"]),
        "emblem" => (round["emblem"] if EMBLEMS.include?(round["emblem"])),
        # The group's logo as a raised relief (ChipRelief), for the "relief" emblem
        "relief" => ChipRelief.clean(round["relief"]),
        "numerals" => (round["numerals"] if NUMERALS.include?(round["numerals"])),
        "finish" => (round["finish"] if FINISHES.include?(round["finish"])),
        "relief_depth" => (round["relief_depth"] if %w[raised inset].include?(round["relief_depth"])),
        "relief_size" => whole(round["relief_size"], 40..96),
        "relief_badge" => (ActiveModel::Type::Boolean.new.cast(round["relief_badge"]) unless round["relief_badge"].nil?),
        "relief_height" => whole(round["relief_height"], 1..10),
        "relief_sharpness" => whole(round["relief_sharpness"], 1..10),
        "scene" => scene(round["scene"]),
        "milestone_at" => (round["milestone_at"] if MILESTONE_SPOTS.include?(round["milestone_at"])),
        "edge" => (round["edge"] if EDGES.include?(round["edge"])),
        "back_ring_top" => text(round["back_ring_top"]),
        "back_ring_bottom" => text(round["back_ring_bottom"]),
        "colors" => colors(round["colors"], ROUND_KEYS),
        "milestones" => milestone_looks(round["milestones"], "round"),
      },
      "triangle" => {
        "sides" => (Array(triangle["sides"]).first(3).map { |s| text(s, 24) || "" } if triangle.key?("sides")),
        "finish" => (triangle["finish"] if TRIANGLE_FINISHES.include?(triangle["finish"])),
        "colors" => colors(triangle["colors"], TRIANGLE_KINDS),
      },
      "meeting" => {
        "shape" => (meeting["shape"] if SHAPES.include?(meeting["shape"])),
        "emblem" => (meeting["emblem"] if MEETING_EMBLEMS.include?(meeting["emblem"])),
        "scene" => scene(meeting["scene"]),
        "sides" => (Array(meeting["sides"]).first(3).map { |s| text(s, 24) || "" } if meeting.key?("sides")),
        "back_text" => back(meeting["back_text"]),
        "finish" => (meeting["finish"] if TRIANGLE_FINISHES.include?(meeting["finish"])),
        "color" => (meeting["color"].to_s.downcase if meeting["color"].to_s.match?(/\A#\h{6}\z/)),
        "milestone_at" => (meeting["milestone_at"] if MILESTONE_SPOTS.include?(meeting["milestone_at"])),
        "edge" => (meeting["edge"] if EDGES.include?(meeting["edge"])),
        "milestones" => milestone_looks(meeting["milestones"], "meeting"),
      },
    }
    out.to_h do |part, values|
      values = values.reject { |k, v| v.nil? || v == DEFAULT[part][k] }
      values["colors"] = values["colors"]&.reject { |k, v| DEFAULT[part]["colors"][k] == v }
      values.delete("colors") if values["colors"].blank?
      values.delete("sides") if values["sides"] && values["sides"].size != 3
      values.delete("milestones") if values["milestones"].blank?
      [part, values]
    end.compact_blank
  end

  # A scene as stored: which template (and version), and the group's own changes to it
  def scene(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    return nil unless raw.is_a?(Hash)

    raw = raw.stringify_keys
    id = whole(raw["template_id"], 1..)
    return nil unless id

    fills = fills(raw["fills"])
    heights = raw["heights"].is_a?(Hash) ? raw["heights"].to_h.first(40).to_h { |k, v| [k.to_s[/\A[\w-]{1,24}\z/], Float(v.to_s, exception: false)&.clamp(0.0, 1.0)&.round(2)] }.select { |k, v| k && v } : {}
    hidden = Array(raw["hidden"]).first(40).map { |l| l.to_s[/\A[\w-]{1,24}\z/] }.compact.uniq
    { "template_id" => id, "version" => whole(raw["version"], 1..),
      "palette" => text(raw["palette"], 30).presence,
      "finish" => (raw["finish"] if SCENE_FINISHES.include?(raw["finish"])),
      "metal" => (raw["metal"] if METALS.key?(raw["metal"])),
      # The chip around the art: metal, or colored plastic in the part's color
      "body" => ("colored" if raw["body"] == "colored"),
      "fills" => fills.presence, "hidden" => hidden.presence, "heights" => heights.presence, "layout" => layout(raw["layout"]) }.compact
  end

  # Each milestone's own look, for a part ("round" or "meeting"): only known milestones and good
  # values. `only` limits what can change (a template sets just the scene's).
  def milestone_looks(raw, part, only: nil)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    return nil unless raw.is_a?(Hash)

    finishes = part == "meeting" ? TRIANGLE_FINISHES : FINISHES
    raw.first(80).to_h do |key, look|
      key = key.to_s
      look = look.to_unsafe_h if look.respond_to?(:to_unsafe_h)
      next [nil, nil] unless MILESTONE_KEYS.fetch(part).call(key) && look.is_a?(Hash)

      look = look.stringify_keys
      out = { "finish" => (look["finish"] if finishes.include?(look["finish"])),
              "color" => (look["color"].to_s.downcase if look["color"].to_s.match?(/\A#\h{6}\z/)),
              "palette" => text(look["palette"], 30).presence,
              "art_finish" => (look["art_finish"] if SCENE_FINISHES.include?(look["art_finish"])),
              "metal" => (look["metal"] if METALS.key?(look["metal"])),
              "body" => (look["body"] if BODIES.include?(look["body"])),
              "fills" => fills(look["fills"]).presence }.compact
      out = out.slice(*only) if only
      [key, out.presence]
    end.compact.presence
  end

  # Bucket fills: a color for each shape
  def fills(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    return {} unless raw.is_a?(Hash)

    raw.to_h.first(3000).to_h { |k, v| [k.to_s[/\A[\w-]{1,24}\z/], v.to_s.downcase] }.select { |k, v| k && v.match?(/\A#\h{6}\z/) }
  end

  # Where an illustrated chip's parts sit (ChipArt.jsx layoutOf): the picture and the milestone
  # on round and triangle chips, and each layer of the art
  def layout(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    return nil unless raw.is_a?(Hash)

    raw = raw.deep_stringify_keys
    layers = raw["layers"].is_a?(Hash) ? raw["layers"].first(40).to_h { |k, v| [k.to_s[/\A[\w-]{1,24}\z/], place(v)] }.select { |k, v| k && v } : {}
    frames = %w[round triangle].to_h do |frame|
      parts = raw[frame].is_a?(Hash) ? %w[art milestone].to_h { |part| [part, place(raw[frame][part])] }.compact : {}
      [frame, parts.presence]
    end
    { "layers" => layers.presence, **frames }.compact.presence
  end

  def place(raw)
    return nil unless raw.is_a?(Hash)

    out = %w[x y s cx cy].to_h { |k| [k, Float(raw[k].to_s, exception: false)] }.compact.select { |_, v| v.finite? }
    out["s"] = out["s"].clamp(0.1, 5.0).round(3) if out["s"]
    %w[x y cx cy].each { |k| out[k] = out[k].clamp(-100_000.0, 100_000.0).round(2) if out[k] }
    out.presence
  end

  def whole(value, range)
    n = Integer(value.to_s, exception: false) || Float(value.to_s, exception: false)&.round
    n if n && range.cover?(n)
  end

  def back(value) = (value.to_s.gsub(/\r\n?/, "\n").gsub(/[ \t]+/, " ").strip.first(240) unless value.nil?)

  def text(value, max = 40)
    value.to_s.squish.first(max) unless value.nil?
  end

  def colors(raw, keys)
    return {} unless raw.is_a?(Hash)

    raw.slice(*keys).select { |_, v| v.to_s.match?(/\A#\h{6}\z/) }.transform_values(&:downcase)
  end
end
