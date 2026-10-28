# The home page people land on after signing in (/people, Api::PeopleController#index):
# notes and highlights from them and the people they follow, and beside them what's coming
# up in their groups: a greeting with their day count, who is filling in at the meetings they're
# part of and what needs them in their roles (TodayDuties), the next meetings, members' sobriety
# birthdays and upcoming events.
class PeopleHome
  MEETINGS_MAX = 3
  BIRTHDAYS_DAYS = 30
  EVENTS_MAX = 5

  def initialize(viewer)
    @viewer = viewer
    @groups = viewer.groups.to_a
  end

  def json
    { me: me, meetings: meetings, birthdays: birthdays, events: events, has_groups: @groups.any? }
      .merge(TodayDuties.new(@viewer).json)
  end

  private

  # The greeting at the top ("Good morning, Colton") and their own day count, whether or not
  # they show their sobriety date to others
  def me
    { first_name: @viewer.display_name.split.first, sobriety_date: @viewer.sobriety_date&.iso8601 }
  end

  # A meeting that started in the last half hour still counts: it's on now
  def meetings
    Meeting.where(group_id: @groups.map(&:id)).includes(:group).filter_map do |m|
      at = m.next_start(30.minutes.ago)
      next unless at && at > 30.minutes.ago

      { id: m.id, name: m.name, group: { slug: m.group.slug, title: m.group.title }, next_start: at.iso8601,
        time_zone: m.time_zone, schedule_label: m.schedule_label, conference_url: m.conference_url,
        conference_url_notes: m.conference_url_notes }
    end.sort_by { |m| m[:next_start] }.first(MEETINGS_MAX)
  end

  # Members of their groups (themselves too) who show their sobriety date, whose
  # anniversary is in the next BIRTHDAYS_DAYS days
  def birthdays
    today = Date.current
    people = User.joins(:group_memberships).merge(GroupMembership.active)
                 .where(group_memberships: { group_id: @groups.map(&:id) }, show_sobriety_date: true)
                 .where.not(sobriety_date: nil).distinct.includes(avatar_attachment: :blob)
    people.filter_map do |u|
      date = anniversary(u.sobriety_date, today)
      years = date.year - u.sobriety_date.year
      next if years < 1 || date > today + BIRTHDAYS_DAYS

      u.as_person_json.merge(date: date.iso8601, years: years, today: date == today)
    end.sort_by { |b| b[:date] }
  end

  def anniversary(start, today)
    this_year = safe_date(today.year, start)
    this_year < today ? safe_date(today.year + 1, start) : this_year
  end

  # Feb 29 birthdays fall on Feb 28 in other years
  def safe_date(year, start) = Date.new(year, start.month, [start.day, Time.days_in_month(start.month, year)].min)

  def events
    Event.published.where(group_id: @groups.map(&:id)).where.not(starts_at: nil).not_past.includes(:group).with_attached_cover
         .upcoming_first.limit(EVENTS_MAX).map { |e| e.card_json.merge(group: { slug: e.group.slug, title: e.group.title }) }
  end
end
