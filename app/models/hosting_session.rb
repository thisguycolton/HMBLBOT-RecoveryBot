# One meeting on one date as its host and co-host run it from the Hosting Command Center: where
# they are in the script, which sections are done, the meeting timer, and which chat postings
# have gone out (and who posted them). Both see the same one; every change bumps `version`.
class HostingSession < ApplicationRecord
  ACTS = %w[goto complete uncomplete timer_start timer_pause timer_reset posted unposted activity clear_activity draw_topic drop_topic].freeze
  LOG_SIZE = 30
  # What fills the script's reading / activity spot: a chapter from the literature, today's page
  # of a daily book, topics drawn from a Topicificator set, a speaker, a meditation, or anything
  ACTIVITY_KINDS = {
    "reading" => "Reading", "daily" => "Daily reading", "topics" => "Topicificator",
    "speaker" => "Speaker", "meditation" => "Meditation", "other" => "Activity",
  }.freeze
  MAX_TOPICS = 20

  belongs_to :meeting
  has_many :presences, class_name: "HostingPresence", dependent: :delete_all

  validates :on, presence: true

  # Seconds on the meeting timer
  def elapsed(now = Time.current) = timer_banked + (timer_started_at ? (now - timer_started_at).to_i : 0)
  def timer_running? = timer_started_at.present?

  # A change from the Command Center, by `user`, kept in the log when it's worth telling the other
  # host. `label` names the section it was about (the sections come from the script, in the page).
  # `pick` is the reading or activity a host picked; `topic` one drawn for them.
  def act!(act, user:, index: nil, posting: nil, label: nil, pick: nil, topic: nil, now: Time.current)
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
            when "timer_start"
              self.timer_started_at ||= now
              "Started the timer"
            when "timer_pause"
              self.timer_banked = elapsed(now)
              self.timer_started_at = nil
              "Paused the timer"
            when "timer_reset"
              self.timer_banked = 0
              self.timer_started_at = nil
              "Reset the timer"
            when "posted"
              self.posted = posted.merge(posting.id.to_s => { "by" => user.display_name, "at" => now.iso8601 })
              "Copied #{posting.title}"
            when "unposted"
              self.posted = posted.except(posting.id.to_s)
              nil
            when "activity"
              self.activity = self.class.tidy_activity(pick).merge("by" => user.display_name, "at" => now.iso8601)
              "Picked #{activity_label}"
            when "clear_activity"
              self.activity = nil
              "Took the reading / activity off"
            when "draw_topic"
              drawn = { "id" => topic.id, "title" => topic.title.to_s, "subtitle" => topic.subtitle.presence, "number" => topic.searchable_number.presence }.compact
              self.activity = activity.merge("topics" => (Array(activity["topics"]) + [drawn]).last(MAX_TOPICS))
              "Drew the topic #{topic.title.to_s.squish.first(60)}"
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
    when "topics"
      out.merge!("topic_set_id" => a["topic_set_id"].to_i.nonzero?, "topic_set_name" => text.call("topic_set_name", 120), "topics" => [])
    end
    out.compact
  end

  def live_json(viewer, now = Time.current)
    {
      version: version, section_index: section_index, completed: completed, posted: posted, log: log.last(12).reverse, activity: activity,
      timer: { running: timer_running?, elapsed: elapsed(now) }, server_now: now.iso8601(3),
      presences: presences.includes(:user).select { |p| p.last_seen_at > HostingPresence::AWAY.ago }.sort_by { |p| p.created_at }.map { |p| p.as_api_json(viewer) },
    }
  end
end
