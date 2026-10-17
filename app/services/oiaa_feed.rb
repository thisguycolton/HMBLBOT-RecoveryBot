require "net/http"

# AA Intergroup's (OIAA's) meeting directory, read from its Meeting Guide JSON feed
# (https://github.com/code4recovery/spec) into OiaaMeeting rows. People see it as "AA Intergroup".
#
# The feed is https://data.aa-intergroup.org/ (it rebuilds the JSON and links to it), or
# AA_INTERGROUP_FEED_URL / the older OIAA_FEED_URL when set. It's about 8 MB and slow, so
# it's fetched in the background: once at boot and whenever it's a week old (STALE_AFTER).
#
# OiaaFeed.sync!               fetch the feed now and refresh linked meetings
# OiaaFeed.refresh_if_stale    the same, in a background thread, when the cache is old
# OiaaFeed.matches(...)        likely listings for a meeting someone is creating
module OiaaFeed
  DEFAULT_FEED = "https://data.aa-intergroup.org/".freeze
  USER_AGENT = "RecoveryBot (https://recoverybot.hmblbot.com)".freeze
  MATCH_THRESHOLD = 35

  class Error < StandardError; end

  module_function

  def feed_url = ENV["AA_INTERGROUP_FEED_URL"].presence || ENV["OIAA_FEED_URL"].presence || DEFAULT_FEED

  # data.aa-intergroup.org rebuilds its export when asked (a few seconds), then answers with a
  # small HTML page linking to the fresh .json; a feed URL that is the JSON itself works too
  def fetch_feed(url = feed_url)
    body = get(url)
    return body if body.lstrip.start_with?("[", "{")

    href = body[/href=["']([^"']+\.json[^"']*)["']/i, 1] or raise Error, "#{url} didn't link to a JSON feed."
    get(URI.join(url, CGI.unescapeHTML(href)).to_s)
  end

  def last_synced_at = OiaaMeeting.maximum(:last_seen_at)
  def stale? = last_synced_at.nil? || last_synced_at < OiaaMeeting::STALE_AFTER.ago

  def sync!(json = nil)
    records = JSON.parse(json || fetch_feed)
    raise Error, "AA Intergroup's feed isn't a list of meetings." unless records.is_a?(Array)

    now = Time.current
    rows = records.filter_map { |r| normalize(r, now) }.uniq { |r| r[:slug] }
    raise Error, "AA Intergroup's feed had no meetings in it." if rows.empty?

    rows.each_slice(1000) { |batch| OiaaMeeting.upsert_all(batch, unique_by: :slug, update_only: batch.first.keys - %i[slug created_at updated_at]) }
    # read back from the database: it keeps microseconds, so `now` itself would compare as newer
    refresh_linked_meetings(last_synced_at)
    rows.size
  end

  @refreshing = Concurrent::AtomicBoolean.new(false)

  def refresh_if_stale
    return unless stale?
    return unless @refreshing.make_true

    Thread.new do
      Rails.application.executor.wrap { sync! }
    rescue StandardError => e
      Rails.logger.warn("[oiaa] refresh failed: #{e.message}")
    ensure
      @refreshing.make_false
    end
  end

  # Copy the feed onto every linked meeting; flag the ones OIAA no longer lists
  def refresh_linked_meetings(synced_at = last_synced_at)
    listings = OiaaMeeting.where(slug: Meeting.linked_to_oiaa.select(:oiaa_slug)).index_by(&:slug)
    Meeting.linked_to_oiaa.includes(:group).find_each do |meeting|
      record = listings[meeting.oiaa_slug]
      if record.nil? || record.last_seen_at < synced_at
        meeting.update_columns(oiaa_missing: true) unless meeting.oiaa_missing
      else
        meeting.apply_oiaa(record)
        meeting.save || Rails.logger.warn("[oiaa] couldn't refresh meeting #{meeting.id}: #{meeting.errors.full_messages.to_sentence}")
      end
    end
  end

  def normalize(record, seen_at)
    return unless record.is_a?(Hash) && record["slug"].present? && record["name"].present?

    days = Array(record["day"]).filter_map { |d| Integer(d.to_s, exception: false) }.select { |d| d.between?(0, 6) }.uniq
    {
      slug: record["slug"].to_s.first(255), name: clean(record["name"]).first(255), group_name: clean(record["group"]).presence&.first(255),
      days: days, start_time: record["time"].to_s.presence, end_time: record["end_time"].to_s.presence,
      time_zone: (record["timezone"].presence if ActiveSupport::TimeZone[record["timezone"].to_s]),
      conference_url: record["conference_url"].to_s.presence&.first(1000),
      conference_url_notes: clean(record["conference_url_notes"]).presence&.first(255),
      conference_phone: record["conference_phone"].to_s.presence&.first(255),
      conference_id: conference_id(record["conference_url"]),
      types: Array(record["types"]).map(&:to_s).first(40), notes: clean(record["notes"]).presence&.first(4000),
      url: record["url"].to_s.presence&.first(1000), last_seen_at: seen_at, created_at: seen_at, updated_at: seen_at,
      **place(record),
    }
  end

  # Where it meets: the spec's attendance_option, and the place for in-person and hybrid
  # meetings (formatted_address, else built from its address parts; regions is the
  # spec's list from broad to narrow)
  def place(record)
    address = clean(record["formatted_address"]).presence ||
              %w[address city state postal_code country].map { |k| clean(record[k]).presence }.compact.join(", ").presence
    region = Array(record["regions"]).map { |r| clean(r) }.reject(&:blank?).join(" > ").presence || clean(record["region"]).presence
    option = record["attendance_option"].to_s.strip.downcase.presence
    {
      attendance_option: (option if %w[online in_person hybrid inactive].include?(option)),
      location: clean(record["location"]).presence&.first(255), formatted_address: address&.first(255), region: region&.first(255),
    }
  end

  def clean(text) = ActionController::Base.helpers.strip_tags(text.to_s).strip

  # The same video meeting written different ways: a Zoom meeting ID (from a link or typed
  # with spaces), or the link's host and path for anything else.
  def conference_id(value)
    text = value.to_s.strip
    return if text.empty?
    return Regexp.last_match(1) if text =~ %r{zoom\.us/(?:j|w|my|s)/(\d{9,11})}i
    digits = text.delete(" -")
    return digits if digits.match?(/\A\d{9,11}\z/)

    uri = URI.parse(text) rescue nil
    uri&.host ? "#{uri.host.downcase.sub(/\Awww\./, '')}#{uri.path.to_s.chomp('/')}".downcase : nil
  end

  # Minute of the week in UTC (Sunday 00:00 = 0) of a weekday + local time in a zone
  def utc_week_minute(day, minute, zone)
    today = zone.today
    local = (today + ((day - today.wday) % 7)).in_time_zone(zone) + minute.minutes
    utc = local.utc
    utc.wday * Meeting::DAY_MINUTES + utc.hour * 60 + utc.min
  end

  # Likely OIAA listings for a meeting being created: { record:, score:, day:, reasons: }.
  # Same video meeting > same weekday and start time > matching words in the name.
  def matches(name: nil, group_name: nil, conference_url: nil, day: nil, start_minute: nil, time_zone: nil, limit: 5)
    id = conference_id(conference_url)
    target = (utc_week_minute(day.to_i, start_minute.to_i, ActiveSupport::TimeZone[time_zone.to_s] || Time.zone) if day.present? && start_minute.present?)
    words = (name.to_s.downcase.scan(/[[:alnum:]']+/) - STOP_WORDS).uniq
    group_words = (group_name.to_s.downcase.scan(/[[:alnum:]']+/) - STOP_WORDS).uniq

    filters = []
    filters << OiaaMeeting.where(conference_id: id) if id
    filters << OiaaMeeting.where("days && ARRAY[?]::integer[]", [(day.to_i - 1) % 7, day.to_i, (day.to_i + 1) % 7]) if target
    (words + group_words).uniq.select { |w| w.length >= 3 }.first(8).each do |w|
      filters << OiaaMeeting.where("name ILIKE :q OR group_name ILIKE :q", q: "%#{OiaaMeeting.sanitize_sql_like(w)}%")
    end
    return [] if filters.empty?

    candidates = filters.reduce { |a, b| a.or(b) }.merge(OiaaMeeting.listed)
    candidates.limit(3000).filter_map do |record|
      reasons = []
      score = 0
      if id && record.conference_id == id
        score += 100
        reasons << "same video meeting"
      end
      best_day = nil
      if target
        record.days.each do |d|
          next unless record.start_minute
          gap = week_gap(target, utc_week_minute(d, record.start_minute, record.zone))
          next unless gap <= 15
          points = gap.zero? ? 45 : 25
          next unless points > (best_day&.last || 0)
          best_day = [d, points]
        end
        if best_day
          score += best_day.last
          reasons << (best_day.last == 45 ? "same day and time" : "within 15 minutes")
        end
      end
      haystack = "#{record.name} #{record.group_name}".downcase
      if words.any?
        found = words.count { |w| haystack.include?(w) }
        if found.positive?
          score += (40.0 * found / words.size).round
          reasons << "similar name"
        end
      end
      if group_words.any? && group_words.all? { |w| haystack.include?(w) }
        score += 15
        reasons << "group name"
      end
      next if score < MATCH_THRESHOLD

      { record: record, score: score, day: best_day&.first || (day.to_i.presence_in(record.days)) || record.days.first, reasons: reasons }
    end.sort_by { |m| [-m[:score], m[:record].name] }.first(limit)
  end

  STOP_WORDS = %w[the a an of and aa meeting meetings group online zoom].freeze

  def week_gap(a, b)
    week = 7 * Meeting::DAY_MINUTES
    gap = (a - b).abs % week
    [gap, week - gap].min
  end

  def get(url, redirects: 3)
    uri = URI(url)
    response = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 30, read_timeout: 600) do |http|
      http.request(Net::HTTP::Get.new(uri, "User-Agent" => USER_AGENT, "Accept" => "application/json, text/html"))
    end
    case response
    when Net::HTTPSuccess then response.body.to_s.force_encoding("UTF-8")
    when Net::HTTPRedirection
      raise Error, "Too many redirects fetching #{url}" if redirects.zero?
      get(URI.join(url, response["location"]).to_s, redirects: redirects - 1)
    else raise Error, "#{url} answered #{response.code}"
    end
  end
end
