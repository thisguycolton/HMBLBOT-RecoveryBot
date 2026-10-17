# The HMBLBOT Editor's blocks, as an event stores them (events.blocks, a JSON array) and a
# group page does (groups.page_blocks, group_page_templates.blocks). Every block has an id,
# a type, the region it sits in ("main" is the larger column, "side" the smaller; the
# centered layout stacks side under main), a span out of 12 columns, and a color from the
# site's palette (COLORS; "default" is the block's usual look).
#
#   heading    text, level (1-3), align
#   notes      markdown; update: true sends each change to everyone following the event
#   conscience_agenda  title: the live agenda of the business meeting this event announces
#              (BusinessMeeting#event); only members of the group see it
#   agenda     title, view (list/grid), activities [{ id, title, description, image_url, queue_number }]
#   guidelines markdown; notify: true sends each change to everyone following the event
#   photo      photos [{ id, url, caption }]; more than one shows as a carousel
#   gallery    title, photos [{ id, url, caption }]
#   poll       poll_token: one of the event's schedule polls, shown with a link to vote
#
# Group pages also have blocks filled in from the group itself (GROUP_TYPES):
#
#   meetings   title: the group's meetings, with their links
#   events     title, limit: its upcoming published events
#   timeline   title, limit: notes members shared to the group (members see them)
#   literature title: the books it approved
#   readings   title, limit: readings members tagged to it (members see them)
#   documents  title, kind (all or a folder), limit, pinned_only: its documents the viewer may
#              see; visitors only get the Public ones (GroupDocument.visible_to)
#   business_meeting  title: the next business meeting; members also see its agenda and can suggest an item
#   decisions  title, limit, category (all or one): its standing decisions the viewer may see;
#              visitors only get the Public ones (Motion.visible_to)
#   members    title: who's in it (members see who; everyone else sees how many)
#   join       title, markdown: asking to join, or starting the group from its listing
#
# On a group page, {{group}} in a heading or text is the group's name.
#
# Profile pages (users.page_blocks, PROFILE_TYPES) have their owner's blocks:
#
#   about      title: their picture, blurb and sobriety date (when they show it)
#   feed       title, limit, show (all/notes/highlights): their notes and highlights, as
#              far as the viewer may see them (Visibility); they post notes from it
#   groups     title: their groups that the viewer is in too (they see all of theirs)
#   people     title, which (following/followers)
#
# Each block has a smaller view for the side column and a larger one for the main column;
# size "auto" follows the column it's in, "compact" or "full" picks one.
module EventBlocks
  TYPES = %w[heading notes agenda guidelines photo gallery poll conscience_agenda].freeze
  GROUP_TYPES = %w[heading notes agenda guidelines photo gallery meetings events timeline literature readings members join documents decisions business_meeting].freeze
  PROFILE_TYPES = %w[heading notes photo gallery about feed groups people].freeze
  COLORS = %w[default accent brand sky indigo emerald amber rose slate].freeze
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

  def normalize(raw, types: TYPES)
    Array(raw).first(MAX_BLOCKS).filter_map { |b| block(b, types) }.uniq { |b| b["id"] }
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

  def block(raw, types = TYPES)
    b = hash(raw)
    type = b["type"].to_s
    return unless types.include?(type)

    span = b["span"].to_i
    base = {
      "id" => id(b["id"]), "type" => type,
      "region" => REGIONS.include?(b["region"]) ? b["region"] : "main",
      "span" => SPANS.include?(span) ? span : 12,
      "size" => SIZES.include?(b["size"]) ? b["size"] : "auto",
      "color" => COLORS.include?(b["color"]) ? b["color"] : "default",
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

  def meetings_fields(b) = { "title" => text(b.fetch("title", "Meetings"), 120) }
  def events_fields(b) = { "title" => text(b.fetch("title", "Coming up"), 120), "limit" => limit(b["limit"], 3) }
  def timeline_fields(b) = { "title" => text(b.fetch("title", "From our members"), 120), "limit" => limit(b["limit"], 10) }
  def literature_fields(b) = { "title" => text(b.fetch("title", "Our literature"), 120) }
  def readings_fields(b) = { "title" => text(b.fetch("title", "Shared readings"), 120), "limit" => limit(b["limit"], 5) }
  def documents_fields(b)
    { "title" => text(b.fetch("title", "Documents"), 120), "kind" => GroupDocument::KINDS.include?(b["kind"]) ? b["kind"] : "all",
      "limit" => limit(b["limit"], 5), "pinned_only" => bool(b["pinned_only"]) }
  end

  def conscience_agenda_fields(b) = { "title" => text(b.fetch("title", "Agenda"), 120) }
  def business_meeting_fields(b) = { "title" => text(b.fetch("title", "Next business meeting"), 120) }

  def decisions_fields(b)
    { "title" => text(b.fetch("title", "Decisions"), 120), "category" => Motion::CATEGORIES.include?(b["category"]) ? b["category"] : "all",
      "limit" => limit(b["limit"], 5) }
  end

  def members_fields(b) = { "title" => text(b.fetch("title", "Members"), 120) }

  def join_fields(b)
    { "title" => text(b.fetch("title", "Join us"), 120),
      "markdown" => b.key?("markdown") ? markdown(b["markdown"]).first(2000) : "Everyone with a desire to stop drinking is welcome." }
  end

  def about_fields(b) = { "title" => text(b.fetch("title", "About"), 120) }

  def feed_fields(b)
    { "title" => text(b.fetch("title", "Timeline"), 120), "limit" => limit(b["limit"], 10),
      "show" => %w[all notes highlights].include?(b["show"]) ? b["show"] : "all" }
  end

  def groups_fields(b) = { "title" => text(b.fetch("title", "Groups"), 120) }

  def people_fields(b)
    which = b["which"] == "followers" ? "followers" : "following"
    { "title" => text(b.fetch("title", which == "followers" ? "Followers" : "Following"), 120), "which" => which }
  end

  # How many items a group block lists, 1 to 20
  def limit(value, default)
    n = value.to_i
    n.between?(1, 20) ? n : default
  end

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
