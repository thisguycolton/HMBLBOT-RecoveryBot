# The HMBLBOT Editor's blocks, as an event stores them (events.blocks, a JSON array).
# Every block has an id, a type, the region it sits in ("main" is the larger column, "side"
# the smaller; the centered layout stacks side under main) and a span out of 12 columns.
#
#   heading    text, level (1-3), align
#   notes      markdown; update: true sends each change to everyone following the event
#   agenda     title, view (list/grid), activities [{ id, title, description, image_url, queue_number }]
#   guidelines markdown; notify: true sends each change to everyone following the event
#   photo      photos [{ id, url, caption }]; more than one shows as a carousel
#   gallery    title, photos [{ id, url, caption }]
#   poll       poll_token: one of the event's schedule polls, shown with a link to vote
#
# Each block has a smaller view for the side column and a larger one for the main column;
# size "auto" follows the column it's in, "compact" or "full" picks one.
module EventBlocks
  TYPES = %w[heading notes agenda guidelines photo gallery poll].freeze
  SIZES = %w[auto compact full].freeze
  REGIONS = %w[main side].freeze
  SPANS = [3, 4, 6, 8, 9, 12].freeze
  MAX_BLOCKS = 80
  MAX_ITEMS = 60
  ID = /\A[A-Za-z0-9_-]{1,40}\z/
  # Pictures come from the event's own uploads (Api::EventsController#images)
  UPLOAD_URL = %r{\A/rails/active_storage/[\w/=.%+-]+\z}

  GUIDELINES_TEMPLATE = <<~MD.freeze
    ## Guidelines

    - Arrive a few minutes early
    - Keep what's shared here, here
    - Phones on silent
  MD

  module_function

  def normalize(raw)
    Array(raw).first(MAX_BLOCKS).filter_map { |b| block(b) }.uniq { |b| b["id"] }
  end

  # Blocks whose changes go out as updates: [id, kind] => the markdown
  def announced(blocks)
    Array(blocks).each_with_object({}) do |b, out|
      case b["type"]
      when "notes" then out[b["id"]] = ["note", b["markdown"]] if b["update"]
      when "guidelines" then out[b["id"]] = ["guidelines", b["markdown"]] if b["notify"]
      end
    end
  end

  def block(raw)
    b = hash(raw)
    type = b["type"].to_s
    return unless TYPES.include?(type)

    span = b["span"].to_i
    base = {
      "id" => id(b["id"]), "type" => type,
      "region" => REGIONS.include?(b["region"]) ? b["region"] : "main",
      "span" => SPANS.include?(span) ? span : 12,
      "size" => SIZES.include?(b["size"]) ? b["size"] : "auto",
    }
    base.merge(send(:"#{type}_fields", b))
  end

  def heading_fields(b)
    level = b["level"].to_i
    { "text" => text(b["text"], 200), "level" => (1..3).cover?(level) ? level : 2,
      "align" => %w[left center right].include?(b["align"]) ? b["align"] : "left" }
  end

  def notes_fields(b)
    { "markdown" => markdown(b["markdown"]), "update" => bool(b["update"]) }
  end

  def guidelines_fields(b)
    { "markdown" => b.key?("markdown") ? markdown(b["markdown"]) : GUIDELINES_TEMPLATE, "notify" => bool(b["notify"]) }
  end

  # Activities keep the order they're listed in; queue_number follows it (1, 2, 3...)
  def agenda_fields(b)
    activities = Array(b["activities"]).first(MAX_ITEMS).filter_map do |raw|
      a = hash(raw)
      title = text(a["title"], 120)
      next if title.blank?

      { "id" => id(a["id"]), "title" => title, "description" => text(a["description"], 280), "image_url" => url(a["image_url"]) }
    end
    activities.each_with_index { |a, i| a["queue_number"] = i + 1 }
    { "title" => text(b.fetch("title", "What's on the agenda"), 120), "view" => b["view"] == "grid" ? "grid" : "list",
      "activities" => activities }
  end

  def photo_fields(b) = { "photos" => photos(b["photos"]) }

  def gallery_fields(b) = { "title" => text(b["title"], 120), "photos" => photos(b["photos"]) }

  def poll_fields(b) = { "poll_token" => b["poll_token"].to_s.match?(/\A[a-z0-9]{1,20}\z/) ? b["poll_token"].to_s : nil }

  def photos(list)
    Array(list).first(MAX_ITEMS).filter_map do |raw|
      p = hash(raw)
      u = url(p["url"]) or next
      { "id" => id(p["id"]), "url" => u, "caption" => text(p["caption"], 200) }
    end
  end

  def hash(raw)
    raw = raw.to_unsafe_h if raw.respond_to?(:to_unsafe_h)
    raw.respond_to?(:to_h) ? raw.to_h.stringify_keys : {}
  end

  def id(value) = value.to_s.match?(ID) ? value.to_s : SecureRandom.alphanumeric(8)
  def text(value, max) = value.to_s.gsub(/[\r\n]+/, " ").strip.first(max)
  def markdown(value) = value.to_s.gsub("\r\n", "\n").first(20_000)
  def url(value) = value.to_s.match?(UPLOAD_URL) ? value.to_s : nil
  def bool(value) = ActiveModel::Type::Boolean.new.cast(value) || false
end
