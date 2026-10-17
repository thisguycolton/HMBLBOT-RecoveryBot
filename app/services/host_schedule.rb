# The host and co-host of every weekly meeting a group has, for the Hosts tab: who is in each
# place now, who is lined up next, who is covering coming dates, and which places are open.
class HostSchedule
  COVER_DAYS = 70

  def initialize(group, viewer)
    @group = group
    @viewer = viewer
    @today = group.zone.today
  end

  def as_json(*)
    meetings = @group.meetings.weekly.ordered.includes(:hosts, :host_covers).to_a
    series = meetings.group_by { |m| [m.name, m.start_minute, m.end_minute] }
    slots = meetings.map { |m| slot(m, series[[m.name, m.start_minute, m.end_minute]]) }
    json = { slots: slots, summary: summary(slots), can_edit: @group.hosts_editable_by?(@viewer) }
    json[:members] = @group.members.map { |u| { id: u.id, name: u.display_name } }.sort_by { |u| u[:name].downcase } if json[:can_edit]
    json
  end

  # Places with nobody in them (and nobody lined up), of all the places there are
  def summary(slots = nil)
    slots ||= as_json[:slots]
    open = ->(role) { slots.count { |s| s[role].nil? && s["#{role}_lined_up".to_sym].nil? } }
    { places: slots.size * 2, open_hosts: open.call(:host), open_co_hosts: open.call(:co_host) }
  end

  private

  def slot(meeting, siblings)
    next_on = meeting.next_start&.to_date
    json = meeting.as_api_json.slice(:id, :name, :day_of_week, :start_minute, :end_minute, :schedule_label)
    json[:series_ids] = siblings.map(&:id)
    json[:next_on] = next_on&.iso8601
    MeetingHost::ROLES.each do |role|
      current = meeting.host_on(role, @today)
      later = meeting.hosts.select { |h| h.role == role && h.starts_on > @today }.min_by(&:starts_on)
      json[role.to_sym] = current&.as_api_json
      json[:"#{role}_lined_up"] = later&.as_api_json
      # who it will be on its next day: someone covering, or whoever is in place then
      cover = next_on && meeting.cover_on(role, next_on)
      held = next_on && meeting.host_on(role, next_on)
      json[:"next_#{role}"] = cover ? { name: cover.name, cover: true } : held ? { name: held.name, cover: false } : nil
    end
    json[:covers] = meeting.host_covers.select { |c| c.on >= @today && c.on <= @today + COVER_DAYS }.sort_by { |c| [c.on, c.role] }.map(&:as_api_json)
    json
  end
end
