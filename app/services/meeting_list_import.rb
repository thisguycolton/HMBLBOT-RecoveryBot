require "csv"

# Imports a local meeting list (MeetingDirectory) from a Meeting Guide feed link, a Meeting
# Guide JSON file, or a CSV (the columns 12 Step Meeting List exports: Day, Time, End Time,
# Name, Location, Address, City, State, Postal Code, Types, Notes, Group...). Mostly for
# in-person meetings, which AA Intergroup's online directory doesn't have.
#
#   import = MeetingListImport.new(directory, url: "https://…") # or text: "<json or csv>"
#   import.preview      what would happen, row by row (nothing is saved)
#   import.apply!(keys:, hide:)  save the chosen rows; take the chosen missing ones off the list
#
# Nothing is ever deleted. A listing that's gone from the source stays listed until an admin
# hides it (groups may have linked their meetings to it). Rows that look like a meeting
# already in Find a meeting (an AA Intergroup listing, another list's, or a group's own) are
# flagged as possible duplicates and left unticked.
class MeetingListImport
  class Error < StandardError; end

  MAX_ROWS = 5000
  # What a listing's preview compares, and shows when it changed
  FIELDS = %i[name group_name days start_time end_time time_zone types notes location location_notes
              formatted_address region attendance_option conference_url conference_url_notes conference_phone url
              latitude longitude].freeze

  DAY_NAMES = Date::DAYNAMES.each_with_index.flat_map { |d, i| [[d.downcase, i], [d[0, 3].downcase, i]] }.to_h
                  .merge("tues" => 2, "weds" => 3, "thur" => 4, "thurs" => 4).freeze

  # The spec's type names, for CSVs that spell them out ("Open, Big Book, Wheelchair Access")
  TYPE_CODES = {
    "11th step meditation" => "11", "12 steps & 12 traditions" => "12x12", "12 & 12" => "12x12", "as bill sees it" => "ABSI",
    "babysitting available" => "BA", "big book" => "B", "birthday" => "H", "breakfast" => "BRK", "candlelight" => "CAN",
    "child-friendly" => "CF", "closed" => "C", "concurrent with al-anon" => "AL-AN", "daily reflections" => "DR",
    "digital basket" => "DB", "discussion" => "D", "english" => "EN", "fragrance free" => "FF", "french" => "FR",
    "gay" => "G", "grapevine" => "GR", "indigenous" => "NDG", "lgbtq" => "LGBTQ", "lesbian" => "L", "literature" => "LIT",
    "living sober" => "LS", "location temporarily closed" => "TC", "meditation" => "MED", "men" => "M", "men only" => "M",
    "newcomer" => "BE", "non-smoking" => "NS", "open" => "O", "outdoor" => "OUT", "outdoor meeting" => "OUT",
    "people of color" => "POC", "professionals" => "P", "secular" => "A", "seniors" => "SEN", "smoking permitted" => "SM",
    "spanish" => "S", "speaker" => "SP", "step meeting" => "ST", "step study" => "ST", "tradition study" => "TR",
    "transgender" => "T", "wheelchair access" => "X", "wheelchair accessible" => "X", "women" => "W", "women only" => "W",
    "young people" => "Y", "american sign language" => "ASL", "asl" => "ASL", "online" => "ONL",
  }.freeze

  CSV_COLUMNS = {
    "slug" => :slug, "id" => :slug, "name" => :name, "meeting" => :name, "meeting name" => :name, "day" => :day, "days" => :day,
    "time" => :time, "start time" => :time, "end time" => :end_time, "end" => :end_time, "location" => :location,
    "location name" => :location, "address" => :address, "street" => :address, "city" => :city, "state" => :state,
    "postal code" => :postal_code, "zip" => :postal_code, "zip code" => :postal_code, "country" => :country,
    "formatted address" => :formatted_address, "types" => :types, "type" => :types, "notes" => :notes,
    "meeting notes" => :notes, "location notes" => :location_notes, "group" => :group, "group name" => :group,
    "region" => :region, "sub region" => :sub_region, "district" => :sub_region, "timezone" => :timezone,
    "time zone" => :timezone, "latitude" => :latitude, "lat" => :latitude, "longitude" => :longitude,
    "lng" => :longitude, "lon" => :longitude, "conference url" => :conference_url, "online meeting url" => :conference_url,
    "conference url notes" => :conference_url_notes, "conference phone" => :conference_phone,
    "attendance option" => :attendance_option, "url" => :url, "website" => :url,
  }.freeze

  attr_reader :directory

  def initialize(directory, url: nil, text: nil)
    @directory = directory
    @url = url.to_s.strip.presence
    @text = text
  end

  # { rows: [...], missing: [...], counts: {...} }. Each row: key, status (new | changed |
  # same | hidden | skipped), changes, duplicates, selected (what Import does by default).
  def preview
    rows = parsed
    existing = directory.listings.where(slug: rows.filter_map { |r| r[:slug] }).index_by(&:slug)
    dupes = Duplicates.new(directory, rows.reject { |r| r[:error] })
    out = rows.map do |row|
      next { key: row[:key], status: "skipped", reason: row[:error], listing: listing_preview(row), selected: false } if row[:error]

      record = existing[row[:slug]]
      changes = record ? changed_fields(record, row) : []
      status = if record.nil? then "new"
               elsif record.hidden_at then "hidden"
               elsif changes.any? then "changed"
               else "same"
               end
      found = dupes.for(row)
      { key: row[:slug], status: status, changes: changes, duplicates: found, listing: listing_preview(row),
        selected: status == "changed" || (status == "new" && found.empty?) }
    end
    seen = rows.filter_map { |r| r[:slug] }
    missing = directory.listings.where(hidden_at: nil).where.not(slug: seen).order(:name).map do |record|
      { key: record.slug, listing: listing_preview(record.attributes.symbolize_keys), linked: linked_count(record.slug) }
    end
    { rows: out, missing: missing, counts: out.group_by { |r| r[:status] }.transform_values(&:size).merge("missing" => missing.size) }
  end

  # Saves the rows whose keys are given (new, changed, or hidden ones to list again) and
  # hides the missing listings in `hide`. Returns counts.
  def apply!(keys:, hide: [], user: nil)
    keys = Array(keys).map(&:to_s).to_set
    hide = Array(hide).map(&:to_s)
    now = Time.current
    rows = parsed.reject { |r| r[:error] }.select { |r| keys.include?(r[:slug]) }
    saved = 0
    hidden = 0
    OiaaMeeting.transaction do
      rows.each_slice(500) do |batch|
        values = batch.map { |r| (FIELDS + %i[slug source_slug conference_id]).index_with { |k| r[k] }.merge(meeting_directory_id: directory.id, hidden_at: nil, last_seen_at: now, created_at: now, updated_at: now) }
        OiaaMeeting.upsert_all(values, unique_by: :slug, update_only: values.first.keys - %i[slug created_at], record_timestamps: false)
        saved += batch.size
      end
      seen = parsed.filter_map { |r| r[:slug] }
      hidden = directory.listings.where(slug: hide - seen, hidden_at: nil).update_all(hidden_at: now, updated_at: now) if hide.any?
      directory.update!(imported_at: now, imported_by: user || directory.imported_by)
    end
    refresh_linked_meetings(rows.map { |r| r[:slug] })
    { saved: saved, hidden: hidden }
  end

  def parsed
    @parsed ||= begin
      body = @text.presence || (@url && OiaaFeed.fetch_feed(@url)) or raise Error, "Give a feed link or a file."
      body = body.dup.force_encoding("UTF-8").delete_prefix("﻿")
      raise Error, "That isn't text we can read." unless body.valid_encoding?

      rows = body.lstrip.start_with?("[", "{") ? json_rows(body) : csv_rows(body)
      raise Error, "There are no meetings in it." if rows.empty?
      raise Error, "That's more than #{MAX_ROWS} meetings; import it in parts." if rows.size > MAX_ROWS

      rows = rows.map { |r| normalize(r) }
      skipped, good = rows.partition { |r| r[:error] }
      # the same listing twice in one source (one row per day): keep the first, add its days
      merged = good.group_by { |r| r[:slug] }.map do |_, same|
        same.first.merge(days: same.flat_map { |r| r[:days] }.uniq.sort)
      end
      merged + skipped
    end
  end

  private

  def json_rows(body)
    data = JSON.parse(body)
    data = data["meetings"] if data.is_a?(Hash)
    raise Error, "The JSON isn't a list of meetings." unless data.is_a?(Array)

    data.select { |r| r.is_a?(Hash) }
  rescue JSON::ParserError => e
    raise Error, "The JSON couldn't be read: #{e.message.first(120)}"
  end

  # A CSV row as the Meeting Guide JSON fields
  def csv_rows(body)
    table = CSV.parse(body, headers: true, skip_blanks: true, liberal_parsing: true)
    columns = table.headers.compact.index_with { |h| CSV_COLUMNS[h.to_s.strip.downcase.tr("_", " ")] }.compact
    raise Error, "The CSV needs at least Name, Day and Time columns." unless (%i[name day time] - columns.values).empty?

    table.map do |line|
      fields = columns.each_with_object({}) { |(header, field), h| h[field] = line[header].to_s.strip.presence || h[field] }
      record = fields.slice(:slug, :name, :location, :address, :city, :state, :postal_code, :country, :formatted_address,
                            :notes, :location_notes, :group, :timezone, :conference_url, :conference_url_notes,
                            :conference_phone, :attendance_option, :url, :latitude, :longitude).transform_keys(&:to_s)
      record["day"] = fields[:day].to_s.split(/[,;\/]|\band\b/).map(&:strip).reject(&:empty?)
      record["time"] = fields[:time]
      record["end_time"] = fields[:end_time]
      record["types"] = fields[:types].to_s.split(/[,;]/).map(&:strip).reject(&:empty?)
      record["regions"] = [fields[:region], fields[:sub_region]].compact
      record
    end
  end

  # A source record as an OiaaMeeting's attributes (plus key, slug; error when it can't be used)
  def normalize(record)
    attrs = OiaaFeed.normalize(record.merge("slug" => record["slug"].presence || "x", "name" => record["name"].presence || "x"), Time.current) || {}
    name = OiaaFeed.clean(record["name"]).first(255)
    days = Array(record["day"]).filter_map { |d| day_number(d) }.uniq.sort
    start_time = clock(record["time"])
    end_time = clock(record["end_time"])
    zone = (record["timezone"].presence if ActiveSupport::TimeZone[record["timezone"].to_s]) || directory.time_zone
    types = Array(record["types"]).filter_map { |t| type_code(t) }.uniq.first(40)
    row = attrs.merge(
      name: name, days: days, start_time: start_time, end_time: end_time, time_zone: zone, types: types,
      location_notes: OiaaFeed.clean(record["location_notes"]).presence&.first(4000),
      url: record["url"].to_s.presence&.first(1000),
    )
    row[:attendance_option] ||= infer_attendance(row)
    source = record["slug"].to_s.strip.presence || [name, start_time, row[:formatted_address] || row[:location]].compact.join(" ")
    source = source.parameterize.first(200)
    row.merge!(source_slug: source, slug: directory.slug_for(source), key: directory.slug_for(source))
    row[:error] =
      if name.blank? then "No name"
      elsif days.empty? then "No day (or a day we couldn't read: #{Array(record['day']).join(', ').presence || 'blank'})"
      elsif start_time.nil? then "No time (or a time we couldn't read: #{record['time'].presence || 'blank'})"
      elsif row[:attendance_option] == "inactive" then "Listed as inactive"
      elsif row[:formatted_address].blank? && row[:location].blank? && row[:conference_url].blank? then "No address or meeting link"
      end
    row
  end

  def infer_attendance(row)
    place = row[:formatted_address].present? || row[:location].present?
    return "in_person" if place && row[:conference_url].blank?
    return "hybrid" if place

    "online" if row[:conference_url].present?
  end

  def day_number(value)
    text = value.to_s.strip.downcase
    return text.to_i if text.match?(/\A[0-6]\z/)

    DAY_NAMES[text] || DAY_NAMES[text.delete_suffix("s")] || DAY_NAMES[text[0, 3]]
  end

  # "19:00", "7:00 PM", "7pm", "0700" -> "19:00" / "07:00"
  def clock(value)
    text = value.to_s.strip.downcase.delete(".")
    m = /\A(\d{1,2})(?::?(\d{2}))?(?::\d{2})?\s*(am|pm|a|p)?\z/.match(text) or return
    hour = m[1].to_i
    minute = m[2].to_i
    if m[3]
      return unless hour.between?(1, 12)
      hour = (hour % 12) + (m[3].start_with?("p") ? 12 : 0)
    end
    return unless hour.between?(0, 23) && minute.between?(0, 59)

    format("%02d:%02d", hour, minute)
  end

  def type_code(value)
    text = value.to_s.strip
    return if text.empty?
    return text if text.length <= 6 && text.match?(/\A[A-Za-z0-9&-]+\z/) && (text == text.upcase || text == "12x12")

    TYPE_CODES[text.downcase]
  end

  def changed_fields(record, row)
    FIELDS.select do |field|
      a = record.public_send(field)
      b = row[field]
      a = a.sort if field == :days && a
      b = b.sort if field == :days && b
      a, b = [a, b].map { |v| v&.to_f&.round(5) } if %i[latitude longitude].include?(field)
      a.presence != b.presence
    end.map(&:to_s)
  end

  def listing_preview(row)
    days = Array(row[:days])
    {
      name: row[:name], group_name: row[:group_name], days: days, start_time: row[:start_time], end_time: row[:end_time],
      schedule: schedule(days, row[:start_time], row[:end_time]), types: row[:types], attendance: row[:attendance_option],
      location: row[:location], address: row[:formatted_address], region: row[:region], notes: row[:notes]&.truncate(160),
      conference_url: row[:conference_url],
    }
  end

  def schedule(days, start_time, end_time)
    names = days.map { |d| Date::ABBR_DAYNAMES[d] }.join(", ").presence || "No day"
    start = OiaaMeeting.minutes(start_time)
    finish = OiaaMeeting.minutes(end_time)
    time = start ? Meeting.clock(start) : "no time"
    "#{names}, #{time}#{finish ? "–#{Meeting.clock(finish)}" : ''}"
  end

  def linked_count(slug) = Meeting.where(oiaa_slug: slug).distinct.count(:group_id)

  def refresh_linked_meetings(slugs)
    return if slugs.empty?

    listings = OiaaMeeting.where(slug: slugs).includes(:meeting_directory).index_by(&:slug)
    Meeting.where(oiaa_slug: slugs).find_each do |meeting|
      record = listings[meeting.oiaa_slug] or next
      next unless record.days.include?(meeting.day_of_week) || record.days.size == 1

      meeting.apply_oiaa(record)
      meeting.save || Rails.logger.warn("[meeting list] couldn't refresh meeting #{meeting.id}: #{meeting.errors.full_messages.to_sentence}")
    end
  end

  # Meetings already in Find a meeting that a row may be: a listing from AA Intergroup or
  # another list, or a group's own meeting, on one of its days at the same start time with
  # a similar name or the same street address; or the same video meeting.
  class Duplicates
    STOP = (OiaaFeed::STOP_WORDS + %w[in on at for to]).freeze

    def initialize(directory, rows)
      times = rows.map { |r| r[:start_time] }.uniq
      ids = rows.filter_map { |r| r[:conference_id] }.uniq
      others = OiaaMeeting.listed.includes(:meeting_directory).where("oiaa_meetings.meeting_directory_id IS DISTINCT FROM ?", directory.id)
      found = others.where(start_time: times.presence || [""])
      found = found.or(others.where(conference_id: ids)) if ids.any?
      @listings = found.limit(20_000).to_a
      @by_time = @listings.group_by(&:start_time)
      @by_conference = @listings.select(&:conference_id).group_by(&:conference_id)
      minutes = times.filter_map { |t| OiaaMeeting.minutes(t) }
      @meetings = Meeting.weekly.where(oiaa_slug: nil, start_minute: minutes.presence || [-1]).includes(:group).to_a.group_by(&:start_minute)
    end

    def for(row)
      found = []
      Array(@by_conference[row[:conference_id]]).each { |r| found << listing_hit(r, "same video meeting") } if row[:conference_id]
      Array(@by_time[row[:start_time]]).each do |r|
        next unless (r.days & row[:days]).any?
        reason = reason(row, r.name, r.group_name, r.formatted_address || r.location)
        found << listing_hit(r, reason) if reason
      end
      Array(@meetings[OiaaMeeting.minutes(row[:start_time])]).each do |m|
        next unless row[:days].include?(m.day_of_week)
        reason = reason(row, m.name, m.group.title, m.formatted_address || m.location)
        found << { kind: "meeting", name: m.name, source: m.group.title, schedule: m.schedule_label, reason: reason, href: "/groups/#{m.group.slug}" } if reason
      end
      found.uniq { |f| [f[:kind], f[:href]] }.first(5)
    end

    private

    def listing_hit(record, reason)
      { kind: "listing", name: record.name, source: record.source_name, schedule: record.schedule_label, reason: reason,
        href: "/groups/find/#{ERB::Util.url_encode(record.slug)}" }
    end

    def reason(row, name, group_name, address)
      return "same day, time and address" if address.present? && street(address) && street(address) == street(row[:formatted_address] || row[:location])

      mine = words(row[:name]) | words(row[:group_name])
      theirs = words(name) | words(group_name)
      return if mine.empty? || theirs.empty?

      shared = (mine & theirs).size
      "same day and time, similar name" if shared.positive? && shared >= [mine.size, theirs.size].min * 0.6
    end

    def words(text) = (text.to_s.downcase.scan(/[[:alnum:]']+/) - STOP).select { |w| w.length > 1 }.uniq

    # "1234 N Main St, Phoenix, AZ" -> "1234 n main st"
    def street(address)
      first = address.to_s.split(",").first.to_s.downcase.gsub(/[^a-z0-9 ]/, " ").squish
      first.match?(/\A\d+ \S/) ? first : nil
    end
  end
end
