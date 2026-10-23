# Where a HostDeck's blocks go (hosting_kits.arrangement), as the layout editor saves it. The
# blocks themselves are drawn in the page (app/javascript/components/groups/hosting/deck/blocks.jsx,
# whose list this mirrors); the built-in "Host a meeting" template is there too (templates.js),
# and a kit with no arrangement uses it.
#
#   layout  both (sidebars left and right), left, right or focus (no sidebars)
#   strip, left, main, right, bar   each a list of blocks: { id, type, tight, grow }
#
# A block goes only where it has a size: the sidebars take side blocks, the middle the stage,
# the strip and the bottom bar the bar ones. Each block is on the deck once, and the stage always
# is (in the middle).
module DeckArrangement
  LAYOUTS = %w[both left right focus].freeze
  REGIONS = %w[strip left main right bar].freeze
  # What size each block has (deck/blocks.jsx)
  SIZES = {
    "stage" => %w[main], "reminders" => %w[bar], "flow" => %w[side], "activity" => %w[side], "meeting_readings" => %w[side],
    "service_readings" => %w[side], "quick_actions" => %w[side], "chat_postings" => %w[side], "share_link" => %w[side],
    "hosts_here" => %w[side], "milestones" => %w[side], "activity_log" => %w[side], "previous" => %w[bar], "clock" => %w[bar], "next" => %w[bar],
  }.freeze
  REGION_SIZE = { "strip" => "bar", "left" => "side", "main" => "main", "right" => "side", "bar" => "bar" }.freeze
  ID = /\A[A-Za-z0-9_-]{1,40}\z/

  # The arrangement as saved: only blocks it knows, where they fit, once each; nil when there's nothing
  def self.normalize(raw)
    return nil if raw.blank?

    raw = raw.to_h.deep_stringify_keys
    seen = Set.new
    out = { "layout" => LAYOUTS.include?(raw["layout"]) ? raw["layout"] : "both" }
    REGIONS.each do |region|
      out[region] = Array(raw[region]).first(SIZES.size).filter_map do |b|
        b = b.to_h.stringify_keys
        type = b["type"].to_s
        next unless SIZES[type]&.include?(REGION_SIZE[region]) && seen.add?(type)

        id = b["id"].to_s.match?(ID) ? b["id"].to_s : type
        { "id" => id, "type" => type, "tight" => (true if b["tight"] == true || b["tight"] == "true"), "grow" => (true if b["grow"] == true || b["grow"] == "true") }.compact
      end
    end
    out["main"] = [{ "id" => "stage", "type" => "stage" }] unless seen.include?("stage")
    out
  end
end
