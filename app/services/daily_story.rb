# Posts the day's Daily Reflection to the RecoveryBot Facebook Page as a Story every morning,
# and to its Instagram when that's turned on (FacebookPageConnection, Site Admin > Daily story).
#
# The video is Share this day's (QuoteCard, drawn here with ffmpeg) at the fastest fade and
# page turn, in Story-sized clips: Facebook and Instagram take Stories of 3 to 60 seconds, so
# a longer day goes up as two or three that play one after another. Each try is kept as a
# DailyStoryPost; when one fails the site admins get a notification.
#
# There is no job runner here, so the server checks every few minutes in a background thread
# (config/puma.rb), and `bin/rails daily_story:post` does the same for a cron job.
module DailyStory
  INTERVAL = 5.minutes
  # If the server was down at the time, it still posts up to this much later
  LATE = 3.hours
  STUCK_AFTER = 30.minutes # a post that started this long ago and never finished (server restarted)
  BOOK = "daily-reflections"
  SPEED = "fast"

  module_function

  # Today's post, when it's time and it hasn't gone yet; the DailyStoryPost, or nil
  def post_due!(now = Time.current)
    connection = FacebookPageConnection.first
    return nil unless connection&.enabled && connection.connected?

    local = now.in_time_zone(connection.zone)
    today = local.to_date
    hours, mins = connection.post_at.split(":").map(&:to_i)
    due = local.change(hour: hours, min: mins)
    return nil unless local >= due && local < due + LATE
    # Claim today first, so two server processes never both post it
    claimed = FacebookPageConnection.where(id: connection.id).where("posted_on IS NULL OR posted_on < ?", today).update_all(posted_on: today)
    return nil if claimed.zero?

    post!(connection, on: today, by: "schedule")
  end

  # Posts the reading for `on` now; the DailyStoryPost (nil when another post is going already)
  def post!(connection, on:, by:, user: nil)
    return nil unless claim(connection)

    begin
      run(connection, on: on, by: by, user: user)
    ensure
      FacebookPageConnection.where(id: connection.id).update_all(posting_started_at: nil)
    end
  end

  # "Post now" from Site Admin, in the background (Instagram takes a minute or two); false
  # when a post is going already
  def post_soon(connection, user:)
    return false if connection.posting_started_at.present? && connection.posting_started_at > STUCK_AFTER.ago

    today = Time.current.in_time_zone(connection.zone).to_date
    FacebookPageConnection.where(id: connection.id).update_all(posted_on: today) # and not again at the usual time
    return post!(connection, on: today, by: "admin", user: user) if Rails.env.test?

    Thread.new do
      Rails.application.executor.wrap { post!(connection, on: today, by: "admin", user: user) }
    rescue StandardError => e
      Rails.logger.warn("[daily story] #{e.class}: #{e.message}")
    end
    true
  end

  # The Daily Reflection for a date ("november-8")
  def chapter_for(on)
    Book.find_by(slug: BOOK)&.chapters&.find_by(slug: "#{Date::MONTHNAMES[on.month].downcase}-#{on.day}")
  end

  # The day's Story clips (MP4s in dir)
  def clips(chapter, look:, dir:)
    QuoteCard.chapter(chapter, look: look, size: "story", video: true, fade: SPEED, turn: SPEED).story_clips(dir)
  end

  def run(connection, on:, by:, user:)
    chapter = chapter_for(on)
    result = { facebook: [], instagram: [], errors: [], clips: 0 }
    begin
      publish(connection, chapter, on, result)
    rescue ShareCard::Failed => e
      result[:errors] << "Couldn't draw the video: #{e.message}"
    rescue StandardError => e
      result[:errors] << "Something went wrong: #{e.class}: #{e.message.to_s.first(300)}"
    end
    status = if result[:errors].empty? then "posted"
             elsif result[:facebook].any? || result[:instagram].any? then "partial"
             else "failed"
             end
    record = DailyStoryPost.create!(on: on, status: status, chapter_title: chapter&.title, clips: result[:clips], facebook_ids: result[:facebook],
                                    instagram_ids: result[:instagram], error: result[:errors].join(" ").presence, triggered_by: by, user: user)
    tell_admins(record) unless status == "posted"
    record
  end

  NETWORK_ERRORS = [MetaGraph::Error, SystemCallError, SocketError, Net::OpenTimeout, Net::ReadTimeout, OpenSSL::SSL::SSLError].freeze

  def publish(connection, chapter, on, result)
    return result[:errors] << "There's no Daily Reflection for #{on.strftime('%B %-d')} in the library." if chapter.nil?
    return result[:errors] << "Daily Reflections is set to members only, so it can't be posted publicly." if chapter.book.members_only?

    Dir.mktmpdir("daily-story") do |dir|
      files = clips(chapter, look: connection.look, dir: dir)
      result[:clips] = files.size
      begin
        files.each { |f| result[:facebook] << MetaGraph.post_page_story(connection.page_id, connection.page_token, f) }
      rescue *NETWORK_ERRORS => e
        result[:errors] << "Facebook: #{explain(e)}"
      end
      next unless connection.instagram_enabled && connection.instagram?

      begin
        files.each { |f| result[:instagram] << MetaGraph.post_instagram_story(connection.instagram_id, connection.page_token, f) }
      rescue *NETWORK_ERRORS => e
        result[:errors] << "Instagram: #{explain(e)}"
      end
    end
  end

  def explain(error)
    return "the connection to the Page stopped working (a password change or the app removed). Connect it again in Site Admin > Daily story." if error.is_a?(MetaGraph::Error) && error.expired_token?

    error.message.to_s.first(300)
  end

  def tell_admins(record)
    Notification.deliver(User.suite_admins, kind: "daily_story.failed",
                                            title: record.status == "partial" ? "Today's story only partly posted" : "Today's story didn't post",
                                            body: record.error, url: "/admin_panel/daily_story")
  rescue StandardError => e
    Rails.logger.warn("[daily story] couldn't tell the admins: #{e.message}")
  end

  # Marks a post as going unless another thread or process just started one
  def claim(connection)
    now = Time.current
    FacebookPageConnection.where(id: connection.id)
                          .where("posting_started_at IS NULL OR posting_started_at < ?", now - STUCK_AFTER)
                          .update_all(posting_started_at: now) == 1
  end

  # The server's own loop (one thread per process; the claims keep two from posting twice)
  def start_loop
    return if @thread&.alive?

    @thread = Thread.new do
      loop do
        begin
          Rails.application.executor.wrap { post_due! }
        rescue StandardError => e
          Rails.logger.warn("[daily story] #{e.class}: #{e.message}")
        end
        sleep INTERVAL
      end
    end
  end
end
