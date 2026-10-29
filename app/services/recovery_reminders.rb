# The daily nudges a member can turn on under account settings, or on the gratitude and 10th
# step pages: "Time for your gratitude list" (noon unless they pick another time) and "Time for
# your 10th step" (6 PM), at that time in their own time zone. A notification in the bell, and a
# push to their devices that turned push on. Each goes out once a day, and not at all when
# today's entry is already written. The server checks every few minutes in a background thread
# (config/puma.rb), and `bin/rails recovery:remind` does the same for a cron job.
module RecoveryReminders
  INTERVAL = 5.minutes
  # If the server was down at the time, a reminder still goes out up to this much later
  LATE = 3.hours

  KINDS = {
    gratitude: { kind: "recovery.gratitude_reminder", model: GratitudeList, url: "/recovery/gratitude",
                 title: "Time for your gratitude list", body: "What are you grateful for today?" },
    step: { kind: "recovery.step_reminder", model: StepInventory, url: "/recovery/inventory",
            title: "Time for your 10th step", body: "A few minutes to look back over the day." },
  }.freeze

  module_function

  def send_due!(now = Time.current)
    KINDS.each_key do |which|
      User.where("#{which}_reminder": true).find_each { |user| remind(user, which, now) }
    end
  end

  # Sends this one reminder to them if it's due; true when it went out
  def remind(user, which, now = Time.current)
    k = KINDS.fetch(which)
    local = now.in_time_zone(user.zone)
    today = local.to_date
    due = local.change(hour: 0) + minutes(user.public_send("#{which}_reminder_at")).minutes
    return false unless local >= due && local < due + LATE
    return false if k[:model].where(user: user, on: today).exists?
    # Claim today's reminder first, so two server processes never both send it
    claimed = User.where(id: user.id).where("#{which}_reminded_on IS NULL OR #{which}_reminded_on < ?", today)
                  .update_all("#{which}_reminded_on": today)
    return false if claimed.zero?

    Notification.deliver(user, kind: k[:kind], title: k[:title], body: k[:body], url: k[:url])
    true
  rescue StandardError => e
    Rails.logger.warn("[recovery reminders] #{user.id} #{which}: #{e.message}")
    false
  end

  # "18:30" -> 1110
  def minutes(at)
    hours, mins = at.to_s.split(":").map(&:to_i)
    hours * 60 + mins
  end

  # The server's own reminder loop (one thread per process)
  def start_loop
    return if @thread&.alive?

    @thread = Thread.new do
      loop do
        begin
          Rails.application.executor.wrap { send_due! }
        rescue StandardError => e
          Rails.logger.warn("[recovery reminders] #{e.message}")
        end
        sleep INTERVAL
      end
    end
  end
end
