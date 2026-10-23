# One meeting on one date as its host and co-host run it from the Hosting Command Center: where
# they are in the script, which sections are done, which chat postings have gone out (and who
# posted them), the day's reading or activity, service and milestones. Both see the same one;
# every change bumps `version`. Kept after the meeting, it's the Time Capsule's record of that day.
# The meeting timer runs from the meeting's start time, in the page (timer_* columns are unused).
class HostingSession < ApplicationRecord
  ACTS = %w[goto complete uncomplete posted unposted activity clear_activity draw_topic drop_topic
            service milestone_add milestone_update milestone_remove milestone_move].freeze
  LOG_SIZE = 30
  # What fills the script's reading / activity spot: a chapter from the literature, one of the
  # host's own readings (a Reading: the page's copy comes along as a chat posting, POSTED_READING),
  # today's page of a daily book, topics drawn from a Topicificator set, a speaker, a meditation, or anything
  ACTIVITY_KINDS = {
    "reading" => "Reading", "my_reading" => "Reading", "daily" => "Daily reading", "topics" => "Topicificator",
    "speaker" => "Speaker", "meditation" => "Meditation", "other" => "Activity",
  }.freeze
  # The key a my_reading activity's chat posting is kept under in `posted` (it isn't a HostChatPosting)
  POSTED_READING = "reading"
  MAX_TOPICS = 20
  MAX_MILESTONES = 40
  # The short link's code: no 0/O, 1/I/L to mix up when it's read out
  CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".chars.freeze
  CODE_LENGTH = 6

  belongs_to :meeting
  has_many :presences, class_name: "HostingPresence", dependent: :delete_all

  validates :on, presence: true
  before_validation(on: :create) { self.code ||= self.class.new_code }

  def self.new_code
    loop do
      code = Array.new(CODE_LENGTH) { CODE_CHARS.sample(random: SecureRandom) }.join
      return code unless exists?(code: code)
    end
  end

  # From the short link, however it was typed
  def self.find_by_code(code) = find_by(code: code.to_s.upcase.gsub(/[^A-Z0-9]/, "").presence)

  def link_path = "/h/#{code}"

  # A change from the Command Center, by `user`, kept in the log when it's worth telling the other
  # host. `label` names the section it was about (the sections come from the script, in the page).
  # `pick` is the reading or activity a host picked; `topic` one drawn for them; `data` a service
  # name ({ value }) or a milestone ({ id, name, length, done, by }).
  def act!(act, user:, index: nil, posting: nil, label: nil, pick: nil, topic: nil, data: {}, now: Time.current)
    data = data.to_h.stringify_keys
    label = label.to_s.squish.first(80).presence
    with_lock do
      # topics are drawn only into a Topicificator activity
      act = nil if act == "draw_topic" && (activity&.dig("kind") != "topics" || topic.nil?)
      did = case act
            when "goto"
              self.section_index = [index.to_i, 0].max
              label && "Moved to #{label}"
            when "complete"
              self.completed = (completed | [index.to_i]).sort
              label ? "Finished #{label}" : "Finished a section"
            when "uncomplete"
              self.completed = completed - [index.to_i]
              nil
            when "posted"
              self.posted = posted.merge(posting.id.to_s => { "by" => user.display_name, "at" => now.iso8601 })
              "Copied #{posting.title}"
            when "unposted"
              self.posted = posted.except(posting.id.to_s)
              nil
            when "activity"
              self.activity = self.class.tidy_activity(pick).merge("by" => user.display_name, "at" => now.iso8601)
              self.posted = posted.except(POSTED_READING)
              "Picked #{activity_label}"
            when "clear_activity"
              self.activity = nil
              self.posted = posted.except(POSTED_READING)
              "Took the reading / activity off"
            when "draw_topic"
              drawn = { "id" => topic.id, "title" => topic.title.to_s, "subtitle" => topic.subtitle.presence, "number" => topic.searchable_number.presence }.compact
              self.activity = activity.merge("topics" => (Array(activity["topics"]) + [drawn]).last(MAX_TOPICS))
              "Drew the topic #{topic.title.to_s.squish.first(60)}"
            when "service"
              key = index.to_s.downcase.gsub(/[^a-z0-9_]/, "").first(40)
              name = data["value"].to_s.squish.first(80).presence
              self.service = name ? service.merge(key => name) : service.except(key) if key.present?
              name && label && "Put #{name} on #{label}"
            when "milestone_add"
              name = data["name"].to_s.squish.first(80).presence
              if name && milestones.size < MAX_MILESTONES
                length = data["length"].to_s.squish.first(60).presence
                self.milestones = milestones + [{ "id" => SecureRandom.hex(6), "name" => name, "length" => length }.compact]
                "Added #{name}#{" (#{length})" if length} to the milestones"
              end
            when "milestone_update"
              self.milestones = milestones.map do |m|
                next m unless m["id"] == data["id"].to_s

                m.merge("name" => data.key?("name") ? data["name"].to_s.squish.first(80).presence || m["name"] : m["name"],
                        "length" => data.key?("length") ? data["length"].to_s.squish.first(60).presence : m["length"],
                        "done" => data.key?("done") ? ActiveModel::Type::Boolean.new.cast(data["done"]) : m["done"]).compact
              end
              nil
            when "milestone_remove"
              self.milestones = milestones.reject { |m| m["id"] == data["id"].to_s }
              nil
            when "milestone_move"
              i = milestones.index { |m| m["id"] == data["id"].to_s }
              j = i && i + (data["by"].to_i.negative? ? -1 : 1)
              self.milestones = milestones.dup.tap { |l| l[i], l[j] = l[j], l[i] } if i && j.between?(0, milestones.size - 1)
              nil
            when "drop_topic"
              self.activity = activity.merge("topics" => Array(activity&.dig("topics")).reject { |t| t["id"].to_s == index.to_s }) if activity
              nil
            end
      self.log = (log + [{ "by" => user.display_name, "user_id" => user.id, "text" => did, "at" => now.iso8601 }]).last(LOG_SIZE) if did
      self.version += 1
      save!
      did
    end
  end

  # {{ milestones }} in a chat posting: "Kim (30 days) and Sam (1 year)" (the page fills it the same way, lib.js)
  def milestones_text
    parts = milestones.map { |m| m["length"].present? ? "#{m["name"]} (#{m["length"]})" : m["name"] }
    parts.size > 1 ? "#{parts[0..-2].join(", ")} and #{parts.last}" : parts.first.to_s
  end

  # "Daily Reflections: October 20" or "Speaker: Kim R."
  def activity_label
    return unless activity

    kind = ACTIVITY_KINDS[activity["kind"]]
    activity["title"].present? ? "#{kind}: #{activity["title"]}" : kind
  end

  # What a host picked, kept to the fields each kind has (topics are drawn on the server)
  def self.tidy_activity(raw)
    a = raw.to_h.stringify_keys
    kind = ACTIVITY_KINDS.key?(a["kind"]) ? a["kind"] : "other"
    text = ->(key, max) { a[key].to_s.squish.first(max).presence }
    out = { "kind" => kind, "title" => text.call("title", 160), "note" => a["note"].to_s.strip.first(1000).presence }
    case kind
    when "reading", "daily"
      out.merge!("book_slug" => text.call("book_slug", 200), "chapter_slug" => text.call("chapter_slug", 200), "book_title" => text.call("book_title", 160))
      out["kind"] = "other" unless out["book_slug"] && out["chapter_slug"]
    when "my_reading"
      # the controller has checked it's the host's own and filled these in from it
      out.merge!("reading_id" => a["reading_id"].to_i.nonzero?, "reading_path" => text.call("reading_path", 200), "reading_topics" => a["reading_topics"].to_s.strip.first(1500).presence,
                 "reading_published" => ActiveModel::Type::Boolean.new.cast(a["reading_published"]) || false)
      out["kind"] = "other" unless out["reading_id"] && out["reading_path"]
    when "topics"
      out.merge!("topic_set_id" => a["topic_set_id"].to_i.nonzero?, "topic_set_name" => text.call("topic_set_name", 120), "topics" => [])
    end
    out.compact
  end

  def live_json(viewer, now = Time.current)
    {
      version: version, section_index: section_index, completed: completed, posted: posted, log: log.last(12).reverse, activity: live_activity,
      service: service, milestones: milestones,
      server_now: now.iso8601(3),
      presences: presences.includes(:user).select { |p| p.last_seen_at > HostingPresence::AWAY.ago }.sort_by { |p| p.created_at }.map { |p| p.as_api_json(viewer) },
    }
  end

  # What the short link shows people without an account, next to the chat postings: which went
  # out and the names that fill them in, but not the hosts' log or who's celebrating
  def public_json(now = Time.current)
    { version: version, posted: posted, activity: live_activity, service: service, server_now: now.iso8601(3) }
  end

  # The activity as it stands now: a reading of the hosts' own is published or not by its
  # published_at, so one scheduled to go live at the meeting's start shows as live once it does
  # (the flag kept at pick time would say it's still a draft)
  def live_activity
    return activity unless activity&.dig("kind") == "my_reading"

    reading = Reading.find_by(id: activity["reading_id"])
    activity.merge("reading_published" => reading&.published? || false)
  end
end
