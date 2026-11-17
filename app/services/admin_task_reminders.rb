# Due-date reminders for Site Admin > Task board (SCRUMBLBOT): after REMIND_HOUR in the site's
# time zone, a task due tomorrow tells whoever has it (or every site admin when nobody does),
# and so does a task that went overdue yesterday. Each goes out once (due_reminded_on,
# overdue_reminded_on). The server checks hourly in a background thread (config/puma.rb), and
# `bin/rails admin_tasks:remind` does the same for a cron job.
module AdminTaskReminders
  INTERVAL = 1.hour
  REMIND_HOUR = 8

  module_function

  def send_due!(now = Time.current)
    local = now.in_time_zone(AdminTask::ZONE)
    return 0 if local.hour < REMIND_HOUR

    today = local.to_date
    sent = 0
    AdminTask.open.where(due_on: today + 1).where("due_reminded_on IS NULL OR due_reminded_on < ?", today).includes(:assignee).find_each do |task|
      next unless claim(task, :due_reminded_on, today)

      AdminTaskNotices.due(task, overdue: false)
      sent += 1
    end
    AdminTask.open.where(due_on: ...today).where(overdue_reminded_on: nil).includes(:assignee).find_each do |task|
      next unless claim(task, :overdue_reminded_on, today)

      AdminTaskNotices.due(task, overdue: true)
      sent += 1
    end
    sent
  end

  # Two server processes never both send it
  def claim(task, column, today)
    AdminTask.where(id: task.id).where("#{column} IS NULL OR #{column} < ?", today).update_all(column => today) == 1
  end

  def start_loop
    return if @thread&.alive?

    @thread = Thread.new do
      loop do
        begin
          Rails.application.executor.wrap { send_due! }
        rescue StandardError => e
          Rails.logger.warn("[admin task reminders] #{e.message}")
        end
        sleep INTERVAL
      end
    end
  end
end
