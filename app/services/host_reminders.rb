# Reminds hosts and co-hosts who asked for it (account settings) before each meeting they're on:
# a notification, and an email unless they turned email off. Each date is reminded once
# (MeetingHostReminder). There is no job runner here, so the server checks every few minutes
# in a background thread (config/puma.rb), and `bin/rails meeting_hosts:remind` does the same
# for a cron job.
module HostReminders
  INTERVAL = 10.minutes

  module_function

  def send_due!(now = Time.current)
    User.where(host_reminders: true).find_each { |user| remind(user, now) }
  end

  def remind(user, now = Time.current)
    HostCommitments.new(user).upcoming(from: now, to: now + user.host_reminder_hours.hours).each do |c|
      begin
        MeetingHostReminder.create!(user: user, meeting: c.meeting, role: c.role, on: c.on)
      rescue ActiveRecord::RecordNotUnique
        next
      end
      Notification.deliver(user, kind: "meeting_host.reminder", title: title(c, now), body: body(c), url: "/groups/#{c.meeting.group.slug}/hosts")
      HostMailer.with(user: user, title: title(c, now), body: body(c), group: c.meeting.group).reminder.deliver_now if user.host_reminder_email
    rescue StandardError => e
      Rails.logger.warn("[host reminders] #{user.id} #{c.meeting.id}: #{e.message}")
    end
  end

  # "You're hosting The Acid Test tomorrow at 9:00 AM MST"
  def title(c, now)
    verb = c.role == "host" ? "hosting" : "co-hosting"
    today = now.in_time_zone(c.starts_at.time_zone).to_date
    day = case (c.on - today).to_i
          when 0 then "today"
          when 1 then "tomorrow"
          else c.starts_at.strftime("%A")
          end
    "You're #{verb} #{c.meeting.name} #{day} at #{c.starts_at.strftime("%-I:%M %p %Z")}"
  end

  def body(c)
    [c.meeting.group.title, c.on.strftime("%a %b %-d"), ("you're covering" if c.cover)].compact.join(" · ")
  end

  # The server's own reminder loop (one thread per process; the unique index keeps two
  # processes from sending the same reminder)
  def start_loop
    return if @thread&.alive?

    @thread = Thread.new do
      loop do
        begin
          Rails.application.executor.wrap { send_due! }
        rescue StandardError => e
          Rails.logger.warn("[host reminders] #{e.message}")
        end
        sleep INTERVAL
      end
    end
  end
end
