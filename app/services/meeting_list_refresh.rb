# Re-imports local meeting lists (MeetingDirectory) from their feed links once a week, so
# an intergroup's new and changed meetings show up without anyone clicking Import.
#
# A refresh does what Import does with its default ticks: it saves new meetings and changed
# ones. It never takes a meeting off, never lists one an admin took off again, and leaves
# possible duplicates alone; those wait for an admin in Site Admin > Meeting lists, which
# shows each list's last refresh (refresh_status "ok", "review" or "error").
#
# There is no job runner here, so the server checks every hour in a background thread
# (config/puma.rb), and `bin/rails meeting_lists:refresh` does the same for a cron job.
module MeetingListRefresh
  EVERY = 7.days
  RETRY_AFTER = 1.day # after a failed refresh
  INTERVAL = 1.hour
  STUCK_AFTER = 1.hour # a refresh that started this long ago and never finished (server restarted)

  module_function

  # Lists with a feed link that are set to refresh and haven't in a week (or failed a day ago)
  def due(now = Time.current)
    MeetingDirectory.where(auto_refresh: true).where.not(feed_url: [nil, ""])
                    .where("refreshed_at IS NULL OR refreshed_at < ? OR (refresh_status = 'error' AND refreshed_at < ?)", now - EVERY, now - RETRY_AFTER)
                    .order(Arel.sql("refreshed_at NULLS FIRST"))
  end

  def refresh_due!(now = Time.current)
    due(now).to_a.count { |directory| refresh!(directory) }
  end

  # Refreshes one list from its feed link. Returns false when another process already is.
  def refresh!(directory)
    return false unless claim(directory)

    import = MeetingListImport.new(directory, url: directory.feed_url)
    preview = import.preview
    rows = preview[:rows]
    picked = rows.select { |r| r[:selected] }
    import.apply!(keys: picked.map { |r| r[:key] }) if picked.any?
    result = {
      new: picked.count { |r| r[:status] == "new" },
      changed: picked.count { |r| r[:status] == "changed" },
      duplicates: rows.count { |r| r[:status] == "new" && !r[:selected] },
      missing: preview[:missing].size,
      skipped: rows.count { |r| r[:status] == "skipped" },
      meetings: rows.size,
    }
    status = result[:duplicates].positive? || result[:missing].positive? ? "review" : "ok"
    directory.update_columns(refresh_status: status, refresh_result: result, refresh_error: nil, refreshed_at: Time.current, refresh_started_at: nil)
    true
  rescue StandardError => e
    Rails.logger.warn("[meeting lists] #{directory.key}: #{e.class}: #{e.message}")
    directory.update_columns(refresh_status: "error", refresh_error: e.message.to_s.first(500), refreshed_at: Time.current, refresh_started_at: nil)
    true
  end

  # Marks the list as refreshing unless another thread or process just did
  def claim(directory)
    now = Time.current
    MeetingDirectory.where(id: directory.id)
                    .where("refresh_started_at IS NULL OR refresh_started_at < ?", now - STUCK_AFTER)
                    .update_all(refresh_started_at: now) == 1
  end

  # Refresh the due lists now in the background (after adding lists), unless already running
  def refresh_soon
    return if Rails.env.test?

    @running ||= Concurrent::AtomicBoolean.new(false)
    return unless @running.make_true

    Thread.new do
      Rails.application.executor.wrap { refresh_due! }
    rescue StandardError => e
      Rails.logger.warn("[meeting lists] refresh failed: #{e.message}")
    ensure
      @running.make_false
    end
  end

  # The server's own weekly-refresh loop (one thread per process; claim keeps two processes
  # from refreshing the same list)
  def start_loop
    return if @thread&.alive?

    @thread = Thread.new do
      loop do
        begin
          Rails.application.executor.wrap { refresh_due! }
        rescue StandardError => e
          Rails.logger.warn("[meeting lists] #{e.message}")
        end
        sleep INTERVAL
      end
    end
  end
end
