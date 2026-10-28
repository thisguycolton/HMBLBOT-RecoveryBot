# The host and co-host of every weekly meeting a group has, for the Meetings page: who is in each
# place now, who is lined up next, who is covering coming dates, and which places are open.
class HostSchedule
  COVER_DAYS = 70

  def initialize(group, viewer)
    @group = group
    @viewer = viewer
    @today = group.zone.today
    @can_edit = group.hosts_editable_by?(viewer)
    # A coordinator limited to some time slots: their meetings (nil when they have them all)
    @my_slot_ids = @can_edit ? group.coordinated_meeting_ids(viewer) : nil
  end

  def as_json(*)
    meetings = @group.meetings.weekly.ordered.includes(:hosts, :host_covers).to_a
    series = meetings.group_by { |m| [m.name, m.start_minute, m.end_minute] }
    slots = meetings.map { |m| slot(m, series[[m.name, m.start_minute, m.end_minute]]) }
    json = { slots: slots, summary: summary(slots), can_edit: @can_edit, can_host: @group.can_host?(@viewer),
             my_slot_ids: @my_slot_ids, sub_requests: sub_requests(meetings), formats: formats }
    if @can_edit
      memberships = @group.active_memberships.includes(:user).to_a
      json[:members] = memberships.map { |m| { id: m.user_id, name: m.user.display_name, membership_id: m.id, can_host: m.can_host } }
                                  .sort_by { |u| [u[:can_host] ? 0 : 1, u[:name].downcase] }
      json[:coordinators] = coordinators(memberships) if @group.manageable_by?(@viewer)
    end
    json
  end

  # Places with nobody in them (and nobody lined up), of all the places there are (for a
  # coordinator limited to time slots, of the places in theirs)
  def summary(slots = nil)
    slots ||= as_json[:slots]
    slots = slots.select { |s| s[:can_edit] } if @my_slot_ids
    open = ->(role) { slots.count { |s| s[role].nil? && s["#{role}_lined_up".to_sym].nil? } }
    { places: slots.size * 2, open_hosts: open.call(:host), open_co_hosts: open.call(:co_host) }
  end

  private

  # The host coordinators an admin can limit to some time slots (admins coordinate them all)
  def coordinators(memberships)
    memberships.select { |m| m.can_schedule_hosts && !m.admin? }.sort_by { |m| m.user.display_name.downcase }.map do |m|
      { membership_id: m.id, name: m.user.display_name, avatar_url: m.user.avatar_url, host_slots_only: m.host_slots_only, host_meeting_ids: m.host_meeting_ids }
    end
  end

  def edits?(meeting) = @can_edit && (@my_slot_ids.nil? || @my_slot_ids.include?(meeting.id))

  # The group's current format and scripts this person may read (a group can keep them for hosts)
  def formats
    GroupDocument.visible_to(@group, @viewer).where(kind: "format", status: "current").ordered
                 .map { |d| { id: d.id, title: d.title, visibility: d.visibility } }
  end

  # The places this person holds now or later, or covers on a coming date, so they can say they
  # won't be there
  def mine(meeting)
    return [] unless @viewer

    MeetingHost::ROLES.select do |role|
      meeting.hosts.any? { |h| h.role == role && h.user_id == @viewer.id && (h.ends_on.nil? || h.ends_on >= @today) } ||
        meeting.host_covers.any? { |c| c.role == role && c.user_id == @viewer.id && c.on >= @today }
    end
  end

  # Open "Need a sub" requests from today on, soonest first
  def sub_requests(meetings)
    HostSubRequest.open.where(meeting_id: meetings.map(&:id)).where("host_sub_requests.on >= ?", @today)
                  .includes(:meeting, :requested_by).order(:on).map do |r|
      r.as_api_json.merge(asked_by_me: !!@viewer && r.requested_by_id == @viewer.id, can_edit: edits?(r.meeting), meeting_name: r.meeting.name, start_minute: r.meeting.start_minute, day_of_week: r.meeting.day_of_week)
    end
  end

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
    json[:mine] = mine(meeting)
    json[:can_edit] = edits?(meeting)
    json[:covers] = meeting.host_covers.select { |c| c.on >= @today && c.on <= @today + COVER_DAYS }.sort_by { |c| [c.on, c.role] }.map(&:as_api_json)
    json
  end
end
