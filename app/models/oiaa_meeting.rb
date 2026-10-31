# A meeting in a directory: OIAA's ("AA Intergroup", cached from its Meeting Guide feed by
# OiaaFeed), or a local meeting list an admin imported (meeting_directory, MeetingListImport),
# such as an area intergroup's in-person meetings. Groups search these to import or link
# their meetings; nothing here is edited by hand.
class OiaaMeeting < ApplicationRecord
  # Linked meetings refresh when the cache is older than this
  STALE_AFTER = 1.week

  belongs_to :meeting_directory, optional: true

  scope :aa_intergroup, -> { where(meeting_directory_id: nil) }
  scope :imported, -> { where.not(meeting_directory_id: nil) }
  # AA Intergroup's listings from its latest sync, and the imported lists' listings that
  # an admin hasn't taken off (they stay until then: there's no feed telling us they've gone)
  scope :listed, lambda {
    where(meeting_directory_id: nil, last_seen_at: (OiaaFeed.last_synced_at || Time.at(0))..)
      .or(where.not(meeting_directory_id: nil).where(hidden_at: nil))
  }

  def self.search(query, limit: 100) = listed.matching(query).order(:name).limit(limit)

  # A name (every word in the name or group name), or a Zoom link or meeting ID
  def self.matching(query)
    id = OiaaFeed.conference_id(query)
    return where(conference_id: id) if id

    query.to_s.downcase.scan(/[[:alnum:]']+/).first(6).reduce(all) do |scope, w|
      scope.where("oiaa_meetings.name ILIKE :q OR oiaa_meetings.group_name ILIKE :q", q: "%#{sanitize_sql_like(w)}%")
    end
  end

  # A group's own listings: the ones AA Intergroup files under its name (the feed's
  # "group"), else ones named exactly like it, else a name search
  def self.for_group(title, limit: 200)
    name = title.to_s.squish.downcase
    return none if name.empty?

    [listed.where("lower(oiaa_meetings.group_name) = ?", name), listed.where("lower(oiaa_meetings.name) = ?", name)]
      .find(&:exists?)&.order(:start_time, :name)&.limit(limit) || search(title, limit: limit)
  end

  def zone = ActiveSupport::TimeZone[time_zone.presence || meeting_directory&.time_zone || "America/New_York"]
  def imported? = meeting_directory_id.present?
  # Who lists it, as people see it: "AA Intergroup" or the imported list's name
  def source_name = meeting_directory&.name || "AA Intergroup"
  def start_minute = self.class.minutes(start_time)
  def end_minute = self.class.minutes(end_time)

  # How long it runs: to its end time (past midnight too), else an hour
  def duration_minutes = self.class.duration(start_minute, end_minute)

  def self.duration(start, finish)
    return 60 unless start && finish
    length = (finish - start) % Meeting::DAY_MINUTES
    length.zero? ? 60 : length
  end

  # The start and end of the meeting on now, or else its next one, over all its days
  def upcoming(now = Time.current)
    return unless start_minute

    from = now - duration_minutes.minutes
    start = days.map { |day| Meeting.weekly_start(day, start_minute, zone, from) }.min
    start && [start, start + duration_minutes.minutes]
  end

  # in_person, online or hybrid: the feed's attendance option, else online (AA Intergroup
  # lists online meetings)
  def attendance
    option = attendance_option.presence_in(%w[online in_person hybrid])
    return option if option
    return "online" unless place

    conference_url.present? ? "hybrid" : "in_person"
  end
  def place = [location, formatted_address].compact_blank.uniq.join(", ").presence

  # Its little map (MeetingMap) and where it is, for an in-person listing
  def map_json
    return { map_url: nil } if place.blank?

    { map_url: "/meeting_maps/listing/#{ERB::Util.url_encode(slug)}.png?v=#{Digest::SHA256.hexdigest(place).first(8)}",
      latitude: latitude&.to_f, longitude: longitude&.to_f }
  end

  def self.minutes(hhmm)
    m = /\A(\d{1,2}):(\d{2})/.match(hhmm.to_s)
    m && (m[1].to_i * 60 + m[2].to_i)
  end

  # Minute of the week in UTC (Sunday 00:00 = 0) for each day it meets, so meetings in
  # different zones compare. Uses the coming week, so daylight time is current.
  def utc_week_minutes
    days.filter_map do |day|
      next unless start_minute
      OiaaFeed.utc_week_minute(day, start_minute, zone)
    end
  end

  def meeting_attributes(day)
    {
      name: name, day_of_week: day, start_minute: start_minute,
      end_minute: end_minute || (start_minute && [start_minute + 60, Meeting::DAY_MINUTES].min),
      time_zone: zone.tzinfo.name, conference_url: conference_url, conference_url_notes: conference_url_notes,
      conference_phone: conference_phone, types: types, oiaa_url: url,
      location: location, formatted_address: formatted_address, latitude: latitude, longitude: longitude,
    }
  end

  def as_api_json
    {
      slug: slug, name: name, group_name: group_name, days: days, start_time: start_time, end_time: end_time,
      time_zone: zone.tzinfo.name, conference_url: conference_url, types: types, url: url,
      schedule_label: schedule_label, attendance: attendance, place: place, source: source_name,
    }
  end

  # "Mon, Wed, Fri, 7:00 PM EDT"
  def schedule_label
    names = days.sort.map { |d| Date::ABBR_DAYNAMES[d] }.join(", ")
    time = start_minute ? Meeting.clock(start_minute) : "any time"
    "#{names.presence || 'No day listed'}, #{time} #{zone.now.strftime('%Z')}"
  end
end
