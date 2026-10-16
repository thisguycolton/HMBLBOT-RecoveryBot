# A meeting in OIAA's directory, cached from its Meeting Guide feed by OiaaFeed. Groups
# search these to import or link their meetings; nothing here is edited by hand.
class OiaaMeeting < ApplicationRecord
  # Linked meetings refresh when the cache is older than this
  STALE_AFTER = 12.hours

  scope :listed, -> { where(last_seen_at: (OiaaFeed.last_synced_at || Time.at(0))..) }

  def self.search(query, limit: 25)
    words = query.to_s.downcase.scan(/[[:alnum:]']+/).first(6)
    id = OiaaFeed.conference_id(query)
    scope = listed
    if id
      scope = scope.where(conference_id: id)
    else
      words.each do |w|
        like = "%#{sanitize_sql_like(w)}%"
        scope = scope.where("oiaa_meetings.name ILIKE :q OR oiaa_meetings.group_name ILIKE :q", q: like)
      end
    end
    scope.order(:name).limit(limit)
  end

  def zone = ActiveSupport::TimeZone[time_zone.presence || "America/New_York"]
  def start_minute = self.class.minutes(start_time)
  def end_minute = self.class.minutes(end_time)

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
    }
  end

  def as_api_json
    {
      slug: slug, name: name, group_name: group_name, days: days, start_time: start_time, end_time: end_time,
      time_zone: zone.tzinfo.name, conference_url: conference_url, types: types, url: url,
      schedule_label: schedule_label,
    }
  end

  # "Mon, Wed, Fri, 7:00 PM EDT"
  def schedule_label
    names = days.sort.map { |d| Date::ABBR_DAYNAMES[d] }.join(", ")
    time = start_minute ? Meeting.clock(start_minute) : "any time"
    "#{names.presence || 'No day listed'}, #{time} #{zone.now.strftime('%Z')}"
  end
end
