# How chips look. DEFAULT is RecoveryBot's own, plain design, for every chip a member earns. A
# group can design its own (groups.chip_design, Group dashboard > Chips) for the chips its hosts
# give (ChipAward), and each meeting its Meeting Maker chips (meetings.chip_design, the triangle
# part only). Only what differs from the default is stored, so the rest follows it.
module ChipDesign
  ROUND_KEYS = %w[24h 30d 60d 90d 6m 9m 18m year].freeze
  EMBLEMS = %w[triangle logo none].freeze
  FINISHES = %w[classic metal plastic].freeze
  NUMERALS = %w[roman number].freeze
  TRIANGLE_FINISHES = %w[metal plastic].freeze

  DEFAULT = {
    "round" => {
      "top_text" => "To thine own self be true",
      "bottom_text" => "Unity · Service · Recovery",
      # On the back, line by line
      "back_text" => "God grant me\nthe serenity\nto accept the things\nI cannot change,\ncourage to change\nthe things I can,\nand wisdom to know\nthe difference.",
      "emblem" => "triangle",
      "numerals" => "roman",
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
  }.freeze
  TRIANGLE_KINDS = DEFAULT["triangle"]["colors"].keys.freeze

  module_function

  def for_group(group) = merge(group&.chip_design)

  # A meeting's Meeting Maker chips: "Meeting Maker" and the meeting's name along the sides
  # unless it changed them
  def for_meeting(meeting)
    design = merge(meeting.chip_design)
    design["triangle"]["sides"] = normalize(meeting.chip_design).dig("triangle", "sides") || meeting_sides(meeting)
    design
  end

  def meeting_sides(meeting) = ["Meeting", "Maker", meeting.name.to_s.first(24)]

  # The stored design laid over the default
  def merge(stored)
    stored = normalize(stored)
    DEFAULT.to_h do |part, defaults|
      given = stored[part] || {}
      [part, defaults.merge(given.except("colors")).merge("colors" => defaults["colors"].merge(given["colors"] || {}))]
    end
  end

  # Only known keys and good values, and only where they differ from the default
  def normalize(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    raw = raw.is_a?(Hash) ? raw.deep_stringify_keys : {}
    round = raw["round"].is_a?(Hash) ? raw["round"] : {}
    triangle = raw["triangle"].is_a?(Hash) ? raw["triangle"] : {}
    out = {
      "round" => {
        "top_text" => text(round["top_text"]),
        "bottom_text" => text(round["bottom_text"]),
        "back_text" => (round["back_text"].to_s.gsub(/\r\n?/, "\n").gsub(/[ \t]+/, " ").strip.first(240) unless round["back_text"].nil?),
        "emblem" => (round["emblem"] if EMBLEMS.include?(round["emblem"])),
        "numerals" => (round["numerals"] if NUMERALS.include?(round["numerals"])),
        "finish" => (round["finish"] if FINISHES.include?(round["finish"])),
        "colors" => colors(round["colors"], ROUND_KEYS),
      },
      "triangle" => {
        "sides" => (Array(triangle["sides"]).first(3).map { |s| text(s, 24) || "" } if triangle.key?("sides")),
        "finish" => (triangle["finish"] if TRIANGLE_FINISHES.include?(triangle["finish"])),
        "colors" => colors(triangle["colors"], TRIANGLE_KINDS),
      },
    }
    out.to_h do |part, values|
      values = values.reject { |k, v| v.nil? || v == DEFAULT[part][k] }
      values["colors"] = values["colors"]&.reject { |k, v| DEFAULT[part]["colors"][k] == v }
      values.delete("colors") if values["colors"].blank?
      values.delete("sides") if values["sides"] && values["sides"].size != 3
      [part, values]
    end.compact_blank
  end

  def text(value, max = 40)
    value.to_s.squish.first(max) unless value.nil?
  end

  def colors(raw, keys)
    return {} unless raw.is_a?(Hash)

    raw.slice(*keys).select { |_, v| v.to_s.match?(/\A#\h{6}\z/) }.transform_values(&:downcase)
  end
end
