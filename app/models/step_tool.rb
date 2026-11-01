# A worksheet for working a step (/recovery/steps): the built-in ones live in
# config/step_tools/*.yml. A member starts one as their own StepWork, which keeps a copy of
# the whole definition, so they can change it (Customize) and later changes to the built-in
# never touch work already started.
#
# A definition is an intro (Markdown) and a list of sections. Every section has an `id`, a
# `kind`, a `title`, optional `help`, and optionally `part` (a heading that starts a new part).
# What each kind is, and where its answers go (StepWork#answers[section id]):
#
#   reference  text to read (`body`), no answers
#   note       a highlighted box (`tone: sponsor` for things to talk over with a sponsor)
#   questions  `items` [{id, label, placeholder, rows}], answers { item id => text }
#   list       one line per thing, answers [text]
#   table      rows with `columns` [{id, label, type: text|choice|choices|date, options, role}],
#              `fill`: row (one row at a time) or column (one column at a time, all rows),
#              `prompts` (starter ideas), `rows_from` {step, role} (offer values from earlier
#              step work), `rows_from_section` {section, column} (a row for each thing picked in
#              a picker here) with `defaults` { value => { column => text } }; answers [{column => value}]
#   picker     `groups` [{label, options}] or `options_from` (another picker's picks), `max`,
#              `suggest_from` {step, role}; answers [picked]
#   each       the same `items` for every row of a table (`from`), pick of a picker (`from`) or
#              entry of `over`, one at a time; answers { thing => { item id => value } }
#   scale      a choice from `options` for each pick of `from`, keeping the earlier ones;
#              answers { thing => [{ value, at }] }
#   days       a question a day (`items`, d1..d7) and end-of-week `review` items, by week;
#              answers [{ started_on, days: { item id => text }, review: { item id => text } }]
#
# `role` marks a column or item so later steps can find it whatever the template calls it:
# `who` (names, for the 8th step list) and `my_part` (for the defects picker in Step 6).
class StepTool
  KINDS = %w[reference note questions list table picker each scale days].freeze
  COLUMN_TYPES = %w[text choice choices date].freeze
  ROLES = %w[who my_part my_part_flag].freeze
  STEPS = (1..12).to_a.freeze

  # The steps, as the 12 Steps of AA put them, for the steps page
  STEP_NAMES = [
    "We admitted we were powerless over alcohol, that our lives had become unmanageable.",
    "Came to believe that a Power greater than ourselves could restore us to sanity.",
    "Made a decision to turn our will and our lives over to the care of God as we understood Him.",
    "Made a searching and fearless moral inventory of ourselves.",
    "Admitted to God, to ourselves, and to another human being the exact nature of our wrongs.",
    "Were entirely ready to have God remove all these defects of character.",
    "Humbly asked Him to remove our shortcomings.",
    "Made a list of all persons we had harmed, and became willing to make amends to them all.",
    "Made direct amends to such people wherever possible, except when to do so would injure them or others.",
    "Continued to take personal inventory and when we were wrong promptly admitted it.",
    "Sought through prayer and meditation to improve our conscious contact with God as we understood Him, praying only for knowledge of His will for us and the power to carry that out.",
    "Having had a spiritual awakening as the result of these Steps, we tried to carry this message to alcoholics, and to practice these principles in all affairs.",
  ].freeze

  attr_reader :key, :step, :steps, :name, :summary, :credit, :definition

  def initialize(data)
    @key = data["key"]
    @step = data["step"]
    @steps = data["steps"] || [@step]
    @name = data["name"]
    @summary = data["summary"]
    @credit = data["credit"]
    @default = !!data["default"]
    @definition = self.class.clean(data.slice("intro", "sections", "credit"))
  end

  def default? = @default

  def self.all
    @all = nil if Rails.env.development?
    @all ||= Dir[Rails.root.join("config/step_tools/*.yml")].sort
                                                           .map { |f| new(YAML.safe_load_file(f)) }
                                                           .sort_by { |t| [t.step, t.default? ? 0 : 1, t.name] }
  end

  def self.find(key) = all.find { |t| t.key == key }

  def as_api_json = { key: key, step: step, steps: steps, name: name, summary: summary, credit: credit, default: default? }

  # A definition someone sent (Customize), made safe: only the kinds and settings above, of
  # sensible sizes. Raises Invalid when it can't be used.
  def self.clean(definition)
    d = definition.respond_to?(:to_unsafe_h) ? definition.to_unsafe_h : definition.to_h
    d = d.deep_stringify_keys
    sections = Array(d["sections"]).first(60).filter_map { |s| clean_section(s) }
    raise Invalid, "A worksheet needs at least one section." if sections.empty?

    ids = sections.map { |s| s["id"] }
    raise Invalid, "Two sections have the same id." if ids.uniq.size != ids.size

    { "intro" => text(d["intro"], 4000), "credit" => text(d["credit"], 300), "sections" => sections }.compact
  end

  def self.clean_section(s)
    s = s.to_h.stringify_keys
    return unless KINDS.include?(s["kind"]) && s["id"].to_s.match?(/\A[\w-]{1,40}\z/)

    out = { "id" => s["id"], "kind" => s["kind"], "title" => text(s["title"], 200), "help" => text(s["help"], 2000), "part" => text(s["part"], 200) }
    case s["kind"]
    when "reference", "note"
      out["body"] = text(s["body"], 4000)
      out["tone"] = "sponsor" if s["tone"] == "sponsor"
    when "questions", "each", "days"
      out["items"] = items(s["items"])
      out["review"] = items(s["review"]) if s["kind"] == "days"
      out["from"] = id(s["from"]) if s["kind"] == "each"
      out["over"] = strings(s["over"], 100) if s["kind"] == "each" && s["over"].present?
    when "list"
      out["placeholder"] = text(s["placeholder"], 200)
    when "table"
      out["columns"] = Array(s["columns"]).first(12).filter_map { |c| column(c) }
      return if out["columns"].empty?

      out["fill"] = s["fill"] == "column" ? "column" : "row"
      out["prompts"] = strings(s["prompts"], 40) if s["prompts"].present?
      out["rows_from"] = link(s["rows_from"]) if s["rows_from"].present?
      if s["rows_from_section"].is_a?(Hash)
        out["rows_from_section"] = { "section" => id(s["rows_from_section"]["section"]), "column" => id(s["rows_from_section"]["column"]) }
        out["defaults"] = s["defaults"].to_h.first(200).to_h { |k, v| [k.to_s.first(100), v.to_h.transform_keys(&:to_s).transform_values { |x| x.to_s.first(300) }] } if s["defaults"].present?
      end
    when "picker"
      out["groups"] = Array(s["groups"]).first(20).map { |g| { "label" => text(g["label"], 100), "options" => strings(g["options"], 60) }.compact }
      out["options_from"] = id(s["options_from"]) if s["options_from"].present?
      out["max"] = s["max"].to_i.clamp(1, 100) if s["max"].present?
      out["suggest_from"] = link(s["suggest_from"]) if s["suggest_from"].present?
    when "scale"
      out["from"] = id(s["from"])
      out["options"] = strings(s["options"], 10)
      return if out["options"].empty?
    end
    out.compact
  end

  def self.items(list)
    Array(list).first(60).filter_map do |i|
      i = i.to_h.stringify_keys
      next unless i["id"].to_s.match?(/\A[\w-]{1,40}\z/) && i["label"].present?

      type = %w[choice choices].include?(i["type"]) ? i["type"] : nil
      { "id" => i["id"], "label" => text(i["label"], 500), "placeholder" => text(i["placeholder"], 300), "rows" => (i["rows"].to_i.clamp(1, 20) if i["rows"].present?),
        "type" => type, "options" => (strings(i["options"], 30) if type), "role" => (i["role"] if ROLES.include?(i["role"])) }.compact
    end
  end

  def self.column(c)
    c = c.to_h.stringify_keys
    return unless c["id"].to_s.match?(/\A[\w-]{1,40}\z/) && c["label"].present?

    type = COLUMN_TYPES.include?(c["type"]) ? c["type"] : "text"
    { "id" => c["id"], "label" => text(c["label"], 200), "type" => type, "help" => text(c["help"], 500),
      "options" => (strings(c["options"], 40) if %w[choice choices].include?(type)), "role" => (c["role"] if ROLES.include?(c["role"])) }.compact
  end

  def self.link(l)
    l = l.to_h.stringify_keys
    step = l["step"].to_i
    return unless STEPS.include?(step) && ROLES.include?(l["role"])

    { "step" => step, "role" => l["role"], "label" => text(l["label"], 100) }.compact
  end

  def self.text(value, max) = value.to_s.strip.first(max).presence
  def self.id(value) = value.to_s[/\A[\w-]{1,40}\z/]
  def self.strings(list, max) = Array(list).map { |x| x.to_s.strip.first(200) }.compact_blank.uniq.first(max)

  class Invalid < StandardError; end
end
