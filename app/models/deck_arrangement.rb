# Where a HostDeck's blocks go (hosting_kits.arrangement), as the layout editor saves it. The
# blocks themselves are drawn in the page (app/javascript/components/groups/hosting/deck/blocks.jsx,
# whose list this mirrors); the built-in "Host a meeting" template is there too (templates.js),
# and a kit with no arrangement uses it.
#
#   layout  both (sidebars left and right), left, right or focus (no sidebars)
#   strip, left, main, right, bar   each a list of blocks: { id, type, tight, grow, settings }
#
# A block goes only where it has a size: the sidebars take side blocks, the middle main ones,
# the strip and the bottom bar the bar ones. Each block is on the deck once (notes, checklists
# and timers as often as wanted), and the stage always is (in the middle).
#
# Settings, for the blocks that have them:
#   notes      title, markdown
#   checklist  title, items [{ id, text }]
#   timer      title, minutes
#   quick_actions  actions (which of QUICK_ACTIONS show; all when there's none), links [{ title, url }]
#   share_queue    title
#   document       title, document_id (one of the group's; the page checks the viewer can read it)
#   links          title, links [{ title, url }]
module DeckArrangement
  LAYOUTS = %w[both left right focus].freeze
  REGIONS = %w[strip left main right bar].freeze
  # What size each block has (deck/blocks.jsx)
  SIZES = {
    "stage" => %w[main], "now_next" => %w[side bar main], "reminders" => %w[bar side], "flow" => %w[side main bar],
    "activity" => %w[side main bar], "topicificator" => %w[side], "meeting_readings" => %w[side main], "service_readings" => %w[side main],
    "quick_actions" => %w[side main bar], "chat_postings" => %w[side main bar], "share_link" => %w[side bar],
    "hosts_here" => %w[side main bar], "service_roles" => %w[side main], "milestones" => %w[side main bar],
    "activity_log" => %w[side main bar], "previous" => %w[bar], "clock" => %w[bar side main], "next" => %w[bar],
    "notes" => %w[side main], "checklist" => %w[side main bar], "timer" => %w[side bar main],
    "share_queue" => %w[side main bar], "document" => %w[side main], "links" => %w[side main bar],
  }.freeze
  # The quick actions a block can show (parts.jsx QUICK_ACTIONS)
  QUICK_ACTIONS = %w[court zoom_open zoom_copy passcode host_schedule time_capsule].freeze
  MAX_LINKS = 20
  # Blocks a deck can have more than one of
  MULTI = %w[notes checklist timer share_queue document links].freeze
  MAX_ITEMS = 50
  REGION_SIZE = { "strip" => "bar", "left" => "side", "main" => "main", "right" => "side", "bar" => "bar" }.freeze
  ID = /\A[A-Za-z0-9_-]{1,40}\z/

  # The arrangement as saved: only blocks it knows, where they fit, once each; nil when there's nothing
  def self.normalize(raw)
    return nil if raw.blank?

    raw = raw.to_h.deep_stringify_keys
    seen = Set.new
    ids = Set.new
    out = { "layout" => LAYOUTS.include?(raw["layout"]) ? raw["layout"] : "both" }
    REGIONS.each do |region|
      out[region] = Array(raw[region]).first(40).filter_map do |b|
        b = b.to_h.stringify_keys
        type = b["type"].to_s
        next unless SIZES[type]&.include?(REGION_SIZE[region]) && (MULTI.include?(type) || seen.add?(type))

        id = b["id"].to_s.match?(ID) ? b["id"].to_s : type
        id = "#{type}-#{SecureRandom.hex(3)}" while ids.include?(id)
        ids << id
        { "id" => id, "type" => type, "tight" => (true if b["tight"] == true || b["tight"] == "true"), "grow" => (true if b["grow"] == true || b["grow"] == "true"),
          "settings" => settings(type, b["settings"]) }.compact
      end
    end
    out["main"] = [{ "id" => "stage", "type" => "stage" }] + out["main"] unless seen.include?("stage")
    out
  end

  # What a block keeps (nil for one that keeps nothing)
  def self.settings(type, raw)
    raw = raw.respond_to?(:to_h) ? raw.to_h.stringify_keys : {}
    title = raw["title"].to_s.squish.first(80).presence
    case type
    when "notes" then { "title" => title, "markdown" => raw["markdown"].to_s.first(10_000) }.compact
    when "checklist"
      items = Array(raw["items"]).first(MAX_ITEMS).filter_map do |i|
        i = i.respond_to?(:to_h) ? i.to_h.stringify_keys : { "text" => i }
        text = i["text"].to_s.squish.first(200)
        { "id" => i["id"].to_s.match?(ID) ? i["id"].to_s : SecureRandom.hex(4), "text" => text } if text.present?
      end
      { "title" => title, "items" => items.uniq { |i| i["id"] } }.compact
    when "timer" then { "title" => title, "minutes" => raw["minutes"].to_i.clamp(1, 180) }.compact
    when "quick_actions"
      actions = (QUICK_ACTIONS & Array(raw["actions"]).map(&:to_s) if raw.key?("actions") && !raw["actions"].nil?)
      links = links(raw["links"])
      { "actions" => actions, "links" => (links if links.any?) }.compact.presence
    when "share_queue" then { "title" => title }.compact
    when "document" then { "title" => title, "document_id" => (raw["document_id"].to_i if raw["document_id"].to_i.positive?) }.compact
    when "links" then { "title" => title, "links" => links(raw["links"]) }.compact
    end
  end

  # Links people can open: http(s) only
  def self.links(raw)
    Array(raw).first(MAX_LINKS).filter_map do |l|
      l = l.respond_to?(:to_h) ? l.to_h.stringify_keys : {}
      url = l["url"].to_s.strip.first(500)
      { "title" => l["title"].to_s.squish.first(80), "url" => url } if url.match?(%r{\Ahttps?://\S+\z}i)
    end
  end
end
