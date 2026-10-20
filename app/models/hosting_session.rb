# One meeting on one date as its host and co-host run it from the Hosting Command Center: where
# they are in the script, which sections are done, the meeting timer, and which chat postings
# have gone out (and who posted them). Both see the same one; every change bumps `version`.
class HostingSession < ApplicationRecord
  ACTS = %w[goto complete uncomplete timer_start timer_pause timer_reset posted unposted].freeze
  LOG_SIZE = 30

  belongs_to :meeting
  has_many :presences, class_name: "HostingPresence", dependent: :delete_all

  validates :on, presence: true

  # Seconds on the meeting timer
  def elapsed(now = Time.current) = timer_banked + (timer_started_at ? (now - timer_started_at).to_i : 0)
  def timer_running? = timer_started_at.present?

  # A change from the Command Center, by `user`, kept in the log when it's worth telling the other
  # host. `label` names the section it was about (the sections come from the script, in the page).
  def act!(act, user:, index: nil, posting: nil, label: nil, now: Time.current)
    label = label.to_s.squish.first(80).presence
    with_lock do
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
            end
      self.log = (log + [{ "by" => user.display_name, "user_id" => user.id, "text" => did, "at" => now.iso8601 }]).last(LOG_SIZE) if did
      self.version += 1
      save!
      did
    end
  end

  def live_json(viewer, now = Time.current)
    {
      version: version, section_index: section_index, completed: completed, posted: posted, log: log.last(12).reverse,
      timer: { running: timer_running?, elapsed: elapsed(now) }, server_now: now.iso8601(3),
      presences: presences.includes(:user).select { |p| p.last_seen_at > HostingPresence::AWAY.ago }.sort_by { |p| p.created_at }.map { |p| p.as_api_json(viewer) },
    }
  end
end
