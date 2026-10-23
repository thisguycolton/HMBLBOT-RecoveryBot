# "Find a meeting" (/groups/meetings): every meeting someone could go to, AA Intergroup's
# listings and the groups' own meetings that aren't linked to one, soonest first, a page
# at a time. Each result is the meeting's next time that fits the filters:
#
#   q          words in the meeting's or group's name, or a Zoom link or meeting ID
#   time_zone  the viewer's zone; dates and times of day are theirs
#   date       "2026-10-20": meetings that day (else the coming week)
#   live       "1": meetings going on right now
#   from, to   minutes after midnight: starting in that part of the day (to < from wraps)
#   attendance online | in_person (hybrid meetings are both)
#   place      a city, region or address, or a time zone ("Pacific", "London")
#   type       a Meeting Guide type code (O, C, SP, W...)
#
# A listing that's one of a group's meetings here shows as that group's, linking to its
# page; the rest link to their default page (/groups/find/:oiaa_slug).
class MeetingFinder
  PER_PAGE = 24
  NOTES_MAX = 180

  # starts_at and ends_at are Unix times: there can be thousands of these
  Hit = Struct.new(:kind, :id, :starts_at, :ends_at)

  attr_reader :zone

  def initialize(viewer, params)
    @viewer = viewer
    @params = params
    @zone = ActiveSupport::TimeZone[params[:time_zone].to_s] || Time.zone
    @now = Time.current.to_i
    @starts = {}
    @dates = {}
    @offsets = {}
  end

  def as_json(*)
    hits = search
    per = PER_PAGE
    pages = [(hits.size.to_f / per).ceil, 1].max
    page = @params[:page].to_i.clamp(1, pages)
    {
      meetings: hydrate(hits.slice((page - 1) * per, per) || []),
      total: hits.size, page: page, pages: pages, per_page: per, time_zone: zone.tzinfo.name,
      synced_at: OiaaFeed.last_synced_at&.iso8601, ready: OiaaFeed.last_synced_at.present?,
    }
  end

  # Every match, soonest first
  def search
    window = self.window
    return [] unless window

    hits = listing_hits(window) + meeting_hits(window)
    hits.sort_by { |h| [h.starts_at, h.kind, h.id] }
  end

  private

  # [from, to) as Unix times: when a meeting may start, or nil when the date is past.
  # Meetings going on now count too, unless the date is another day.
  def window
    if live?
      [@now, @now]
    elsif (date = Date.iso8601(@params[:date].to_s) rescue nil)
      from = zone.local(date.year, date.month, date.day)
      to = (from + 1.day).to_i
      to > @now ? [from.to_i, to] : nil
    else
      [@now, @now + 7.days.to_i]
    end
  end

  def live? = ActiveModel::Type::Boolean.new.cast(@params[:live])

  # --- AA Intergroup's listings, plucked: 8,000 of them fit in memory fine ---

  def listing_hits(window)
    rows = listings.pluck(:id, :days, :start_time, :end_time, :time_zone)
    rows.filter_map do |id, days, start_time, end_time, time_zone|
      start = OiaaMeeting.minutes(start_time) or next
      length = OiaaMeeting.duration(start, OiaaMeeting.minutes(end_time))
      at = first_start(days, start, length, zone_named(time_zone.presence || "America/New_York"), window) or next
      Hit.new("oiaa", id, at, at + length * 60)
    end
  end

  def listings
    scope = OiaaMeeting.listed.where("oiaa_meetings.attendance_option IS NULL OR oiaa_meetings.attendance_option <> 'inactive'")
    if query.present?
      # ...or it's one of the meetings of a group here with those words in its name
      words = query.downcase.scan(/[[:alnum:]']+/).first(6)
      groups = words.reduce(Group.viewable_by(@viewer)) { |g, w| g.where("groups.title ILIKE ?", "%#{Group.sanitize_sql_like(w)}%") }
      scope = scope.merge(OiaaMeeting.matching(query).or(OiaaMeeting.where(slug: Meeting.where(group_id: groups.select(:id)).select(:oiaa_slug))))
    end
    scope = scope.where("oiaa_meetings.types @> ARRAY[?]::varchar[]", type) if type
    case attendance
    when "online" then scope = scope.where("oiaa_meetings.attendance_option IS NULL OR oiaa_meetings.attendance_option IN ('online', 'hybrid')")
    when "in_person" then scope = scope.where(attendance_option: %w[in_person hybrid])
    end
    if place.present?
      like = "%#{OiaaMeeting.sanitize_sql_like(place)}%"
      zones = zones_matching(place, OiaaMeeting.distinct.pluck(:time_zone).compact)
      scope = scope.where("oiaa_meetings.location ILIKE :q OR oiaa_meetings.formatted_address ILIKE :q OR oiaa_meetings.region ILIKE :q OR oiaa_meetings.time_zone IN (:zones)",
                          q: like, zones: zones.presence || [""])
    end
    scope
  end

  # --- the groups' own meetings (the ones linked to a listing show as the listing) ---

  def meeting_hits(window)
    own_meetings.filter_map do |m|
      length = m.duration_minutes * 60
      if m.once?
        start = m.starts_at.to_i
        next unless fits?(start, start + length, window)
      else
        start = first_start([m.day_of_week], m.start_minute, m.duration_minutes, zone_named(m.time_zone), window) or next
      end
      Hit.new("meeting", m.id, start, start + length)
    end
  end

  def own_meetings
    scope = Meeting.where(oiaa_slug: nil, group_id: Group.viewable_by(@viewer).select(:id)).joins(:group)
    scope = scope.where.not(start_minute: nil).or(scope.where.not(starts_at: nil))
    id = OiaaFeed.conference_id(query)
    query.to_s.downcase.scan(/[[:alnum:]']+/).first(6).each do |w|
      scope = scope.where("meetings.name ILIKE :q OR groups.title ILIKE :q", q: "%#{Meeting.sanitize_sql_like(w)}%")
    end unless id
    scope = scope.where("meetings.types @> ARRAY[?]::varchar[]", type) if type
    scope = scope.where.not(conference_url: [nil, ""]) if attendance == "online"
    scope = scope.where("COALESCE(meetings.location, '') <> '' OR COALESCE(meetings.formatted_address, '') <> ''") if attendance == "in_person"
    if place.present?
      like = "%#{Meeting.sanitize_sql_like(place)}%"
      scope = scope.where("meetings.location ILIKE :q OR meetings.formatted_address ILIKE :q OR groups.location ILIKE :q OR meetings.time_zone IN (:zones)",
                          q: like, zones: zones_matching(place, Meeting.distinct.pluck(:time_zone)).presence || [""])
    end
    found = scope.to_a
    id ? found.select { |m| OiaaFeed.conference_id(m.conference_url) == id } : found
  end

  # --- when ---

  # The first start of a weekly meeting that fits, over the days around the window
  def first_start(days, minute, length, meeting_zone, window)
    return if days.blank? || minute.nil?

    dates(meeting_zone, window).each do |date|
      next unless days.include?(date.wday)
      start = local_start(meeting_zone, date, minute)
      return start if fits?(start, start + length * 60, window)
    end
    nil
  end

  # The calendar days in a zone that a window touches, from the day before it
  def dates(meeting_zone, (from, to))
    @dates[meeting_zone.name] ||= begin
      first = Time.at(from - 1.day.to_i).in_time_zone(meeting_zone).to_date
      (first..Time.at(to).in_time_zone(meeting_zone).to_date).to_a
    end
  end

  def fits?(start, finish, (from, to))
    return false unless finish > @now
    return start <= @now if live?
    on_now = from <= @now && start <= @now
    (on_now || (start >= from && start < to)) && in_time_of_day?(start)
  end

  def in_time_of_day?(start)
    from = minute_param(:from)
    to = minute_param(:to)
    return true unless from || to

    minute = ((start + viewer_offset(start)) % 1.day.to_i) / 60
    from ||= 0
    to ||= Meeting::DAY_MINUTES
    from <= to ? minute >= from && minute < to : minute >= from || minute < to
  end

  def local_start(meeting_zone, date, minute)
    @starts[[meeting_zone.name, date, minute]] ||= meeting_zone.local(date.year, date.month, date.day, minute / 60, minute % 60).to_i
  end

  # The viewer's UTC offset at a Unix time (zones change offset on the hour)
  def viewer_offset(at)
    @offsets[at / 3600] ||= zone.tzinfo.period_for_utc(Time.at(at).utc).utc_total_offset
  end

  def zone_named(name)
    (@zones ||= {})[name] ||= ActiveSupport::TimeZone[name] || ActiveSupport::TimeZone["America/New_York"]
  end

  # Time zones whose name or Rails name ("Pacific Time (US & Canada)") has `text` in it
  def zones_matching(text, names)
    needle = text.downcase.tr("_", " ")
    friendly = ActiveSupport::TimeZone::MAPPING.each_with_object(Hash.new { |h, k| h[k] = [] }) { |(name, id), h| h[id] << name }
    names.select do |id|
      ([id.tr("_", " ")] + friendly[id]).any? { |n| n.downcase.include?(needle) }
    end
  end

  # --- params ---

  def query = @params[:q].to_s.strip.first(200)
  def place = @params[:place].to_s.strip.first(100)
  def type = @params[:type].presence&.to_s&.first(20)
  def attendance = @params[:attendance].to_s.presence_in(%w[online in_person])

  def minute_param(key)
    value = @params[key].presence or return
    Integer(value.to_s, exception: false)&.clamp(0, Meeting::DAY_MINUTES)
  end

  # --- what a page of results shows ---

  def hydrate(hits)
    listings = OiaaMeeting.where(id: hits.select { |h| h.kind == "oiaa" }.map(&:id)).index_by(&:id)
    meetings = Meeting.where(id: hits.select { |h| h.kind == "meeting" }.map(&:id)).includes(group: { cover_attachment: :blob }).index_by(&:id)
    groups = groups_for(listings.values)
    template_cover = image_path(GroupPageTemplate.current.cover)
    counts = GroupMembership.active.where(group_id: (groups.values + meetings.values.map(&:group)).map(&:id)).group(:group_id).count

    hits.filter_map do |hit|
      if hit.kind == "oiaa"
        record = listings[hit.id] or next
        group = groups[record.slug]
        linked = @linked[record.slug]
        share = linked && linked.group == group ? share_json(linked) : group ? share_json(group) : share_json(record)
        listing_json(record, hit, group ? group_json(group, counts) : intergroup_json(record, template_cover)).merge(share: share)
      else
        meeting = meetings[hit.id] or next
        meeting_json(meeting, hit, group_json(meeting.group, counts)).merge(share: share_json(meeting))
      end
    end
  end

  # The group here that a listing belongs to: one of its meetings is linked to it, or it
  # has the listing's name; only groups whose page the viewer may see
  def groups_for(records)
    @linked = Meeting.where(oiaa_slug: records.map(&:slug)).includes(group: { cover_attachment: :blob }).index_by(&:oiaa_slug)
    linked = @linked.transform_values(&:group)
    names = records.flat_map { |r| [r.group_name, r.name] }.compact.map(&:downcase).uniq
    by_title = Group.where("LOWER(title) IN (?)", names.presence || [""]).includes(cover_attachment: :blob).index_by { |g| g.title.downcase }
    records.each_with_object({}) do |r, found|
      group = linked[r.slug] || by_title[r.group_name.to_s.downcase] || by_title[r.name.downcase]
      found[r.slug] = group if group&.page_visible_to?(@viewer)
    end
  end

  def group_json(group, counts)
    { title: group.title, description: group.description, cover_url: image_path(group.cover), members_count: counts[group.id] || 0,
      href: "/#{group.slug}", here: true }
  end

  def intergroup_json(record, cover)
    { title: record.group_name.presence || record.name, cover_url: cover, members_count: 0,
      href: "/find/#{ERB::Util.url_encode(record.slug)}", here: false }
  end

  def listing_json(record, hit, group)
    occurrence_json(hit).merge(
      key: "oiaa-#{record.slug}", name: record.name, group: group, days: record.days.sort, recurrence: "weekly",
      schedule_label: record.schedule_label, time_zone: record.zone.tzinfo.name, types: record.types,
      attendance: record.attendance, place: record.place, region: record.region, conference_url: record.conference_url, conference_url_notes: record.conference_url_notes,
      notes: record.notes&.squish&.truncate(NOTES_MAX),
    )
  end

  def meeting_json(meeting, hit, group)
    occurrence_json(hit).merge(
      key: "meeting-#{meeting.id}", name: meeting.name, group: group, days: meeting.weekly? ? [meeting.day_of_week] : [],
      recurrence: meeting.recurrence, schedule_label: meeting.schedule_label, time_zone: meeting.time_zone, types: meeting.types,
      attendance: meeting.attendance, place: meeting.place, region: nil, conference_url: meeting.conference_url, conference_url_notes: meeting.conference_url_notes,
      notes: meeting.notes&.squish&.truncate(NOTES_MAX),
    )
  end

  # The link the card's Share button sends (ShareMeta's path), and its picture when the
  # group's page is for everyone
  def share_json(record)
    meta = ShareMeta.path_for(record)
    image = record.is_a?(OiaaMeeting) || (record.is_a?(Group) ? record : record.group).active?
    { path: meta[:path], image: image ? "/share_cards/#{meta[:kind]}/#{ERB::Util.url_encode(meta[:id].to_s)}.png" : nil }
  end

  def occurrence_json(hit)
    { starts_at: Time.at(hit.starts_at).utc.iso8601, ends_at: Time.at(hit.ends_at).utc.iso8601, live: hit.starts_at <= @now && hit.ends_at > @now }
  end

  def image_path(attachment)
    return unless attachment.attached?

    Rails.application.routes.url_helpers.rails_storage_proxy_path(attachment, only_path: true)
  end
end
