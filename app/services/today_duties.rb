# The service part of the Today panel (PeopleHome): who is filling in for whom at the coming
# meetings ("Colton is filling in as co-host for the 9 AM Acid Test meeting"), shown to the one
# filling in, the one they fill in for and the meeting's host coordinators; and what needs the
# viewer in each role they hold, in all their groups ("Needs your attention"): their coming host
# dates and the subs they could take, the places a coordinator has to fill, a record keeper's
# drafts and suggestions, a treasurer's reports, join requests for an admin, and terms nearly up.
# Items they cleared (TodayDismissal) come back separately, as `cleared`, to restore.
class TodayDuties
  DAYS = 7          # how far ahead fills-ins and host dates are shown
  HOST_DATES_MAX = 4
  SUBS_MAX = 3
  URGENT_DAYS = 2   # an unfilled place this soon is marked urgent

  def initialize(viewer, memberships = nil)
    @viewer = viewer
    @memberships = (memberships || viewer.group_memberships.active.includes(:group).to_a).select(&:active?)
    @by_group = @memberships.index_by(&:group_id)
  end

  def json
    cleared, open = attention.partition { |item| cleared?(item) }
    { covers: covers, attention: open, cleared: cleared, any_roles: any_roles? }
  end

  # The coming dates someone fills in at, that this viewer is part of (or, given a group, every
  # one in the meetings they coordinate there: the group Dashboard)
  def covers(group: nil)
    groups = group ? [group] : @memberships.map(&:group)
    scope = MeetingHostCover.joins(:meeting).where(meetings: { group_id: groups.map(&:id) })
                            .where(on: (Date.current - 1)..(Date.current + DAYS + 1))
                            .includes(meeting: %i[group hosts])
    scope.filter_map do |cover|
      meeting = cover.meeting
      start = starts_at(meeting, cover.on)
      next if ends_at(meeting, start) < Time.current || cover.on > meeting.group.zone.today + DAYS

      original = meeting.host_on(cover.role, cover.on)
      original = nil if original&.user_id.present? && original.user_id == cover.user_id
      mine = cover.user_id == @viewer.id
      theirs = original&.user_id == @viewer.id
      coordinating = coordinates?(meeting)
      next unless mine || theirs || coordinating
      next if group && !coordinating

      { id: cover.id, on: cover.on.iso8601, starts_at: start.iso8601, mine: mine, for_me: theirs,
        text: cover_text(cover, original, mine, theirs), group: group_json(meeting.group), href: meetings_href(meeting.group) }
    end.sort_by { |c| c[:starts_at] }
  end

  # Whether they hold any role that "Needs your attention" speaks for
  def any_roles?
    @memberships.any? { |m| m.admin? || m.can_keep_records || m.can_keep_treasury || m.can_schedule_hosts || m.can_host } ||
      HostCommitments.new(@viewer).meetings.any? || own_terms.any?
  end

  def attention
    items = host_items + @memberships.flat_map { |m| group_items(m) } + term_items
    items.each_with_index.sort_by { |item, i| [item[:urgent] ? 0 : 1, item[:on] || "9999", i] }.map(&:first)
  end

  private

  def dismissals = @dismissals ||= @viewer.today_dismissals.pluck(:key, :title).to_h

  def cleared?(item) = dismissals[item[:key]] == item[:title].to_s.truncate(255)

  def admin?(m) = m.admin?
  def keeper?(m) = m.admin? || m.can_keep_records
  def treasurer?(m) = keeper?(m) || m.can_keep_treasury
  def coordinator?(m) = m.admin? || m.can_schedule_hosts
  def coordinates?(meeting) = !!@by_group[meeting.group_id]&.then { |m| coordinator?(m) && m.coordinates?(meeting) }

  # As a host or co-host: their coming dates, the subs they could take and their own requests
  # nobody has taken
  def host_items
    commitments = HostCommitments.new(@viewer)
    dates = commitments.upcoming(from: 30.minutes.ago, to: DAYS.days.from_now).reject(&:cover).first(HOST_DATES_MAX).map do |c|
      today = c.on == c.meeting.group.zone.today
      { key: "date-#{c.meeting.id}-#{c.role}-#{c.on}", role: role_label(c.role), group: group_json(c.meeting.group), on: c.on.iso8601,
        title: "You're #{article(c.role)} #{place(c.role)} for the #{slot_label(c.meeting)} meeting", urgent: today,
        note: "Can't make it? Ask for a sub on Meetings", href: meetings_href(c.meeting.group) }
    end
    takeable = commitments.open_sub_requests.reject { |r| coordinates?(r.meeting) }.first(SUBS_MAX).map do |r|
      { key: "take-#{r.id}", role: "Host", group: group_json(r.meeting.group), on: r.on.iso8601,
        title: "Sub needed: #{place(r.role)} for the #{slot_label(r.meeting)} meeting", urgent: false,
        note: r.note || "Can you fill in? Take it on Meetings", href: meetings_href(r.meeting.group) }
    end
    asked = HostSubRequest.open.where(requested_by: @viewer).where("host_sub_requests.on >= ?", Date.current)
                          .joins(:meeting).where(meetings: { group_id: @by_group.keys }).includes(meeting: :group).order(:on).to_a
                          .reject { |r| coordinates?(r.meeting) }.map do |r|
      { key: "asked-#{r.id}", role: role_label(r.role), group: group_json(r.meeting.group), on: r.on.iso8601, urgent: soon?(r),
        title: "Nobody has taken your #{place(r.role)} place at the #{slot_label(r.meeting)} meeting yet",
        note: "You asked for a sub", href: meetings_href(r.meeting.group) }
    end
    dates + asked + takeable
  end

  def group_items(m)
    items = []
    items += coordinator_items(m) if coordinator?(m)
    items += admin_items(m) if admin?(m)
    items += keeper_items(m) if keeper?(m)
    items += treasurer_items(m) if treasurer?(m)
    items
  end

  def coordinator_items(m)
    group = m.group
    meetings = group.meetings.weekly.to_a.select { |meeting| m.coordinates?(meeting) }
    requests = HostSubRequest.open.where(meeting_id: meetings.map(&:id)).where("host_sub_requests.on >= ?", group.zone.today)
                             .includes(:meeting, :requested_by).order(:on).limit(10).map do |r|
      { key: "sub-#{r.id}", role: "Host coordinator", group: group_json(group), on: r.on.iso8601, urgent: soon?(r),
        title: "No #{place(r.role)} yet for the #{slot_label(r.meeting)} meeting",
        note: r.requested_by ? "#{r.requested_by_id == @viewer.id ? "You" : r.requested_by.display_name} asked for a sub" : "A sub is needed",
        href: meetings_href(group) }
    end
    summary = HostSchedule.new(group, @viewer).summary
    open = summary[:open_hosts] + summary[:open_co_hosts]
    requests << { key: "open-#{group.id}", role: "Host coordinator", group: group_json(group), urgent: false,
                  title: "#{open} host #{open == 1 ? "place is" : "places are"} open",
                  note: "#{summary[:open_hosts]} #{summary[:open_hosts] == 1 ? "host" : "hosts"} and #{summary[:open_co_hosts]} #{summary[:open_co_hosts] == 1 ? "co-host" : "co-hosts"} needed across the week",
                  href: meetings_href(group) } if open.positive?
    requests
  end

  def admin_items(m)
    group = m.group
    asking = group.memberships.requested.count
    return [] if asking.zero?

    [{ key: "join-#{group.id}", role: "Group admin", group: group_json(group), urgent: false,
       title: "#{asking} #{asking == 1 ? "person is" : "people are"} asking to join", note: "Let them in, or not, on Members",
       href: "/groups/#{group.slug}/members" }]
  end

  def keeper_items(m)
    group = m.group
    today = group.zone.today
    base = "/groups/#{group.slug}/conscience"
    items = []
    meeting = BusinessMeeting.next_for(group, @viewer)
    if meeting && meeting.held_on <= today + DAYS
      count = meeting.agenda_items.count
      items << { key: "bm-#{meeting.id}", role: "Record keeper", group: group_json(group), on: meeting.held_on.iso8601, urgent: meeting.held_on <= today + 1,
                 title: "Business meeting #{day_name(meeting.held_on, today)}", note: count.zero? ? "Nothing on the agenda yet" : "#{count} #{count == 1 ? "item" : "items"} on the agenda",
                 href: "#{base}/meetings/#{meeting.id}" }
    end
    suggested = AgendaItem.joins(:business_meeting).where(business_meetings: { group_id: group.id, status: "planned" }, status: "suggested").count
    items << { key: "suggested-#{group.id}", role: "Record keeper", group: group_json(group), urgent: false,
               title: "#{suggested} suggested agenda #{suggested == 1 ? "item" : "items"}", note: "Put them on the agenda or decline them", href: "#{base}/meetings" } if suggested.positive?
    group.business_meetings.where(status: "held", minutes_status: "draft").newest_first.limit(3).each do |held|
      items << { key: "minutes-#{held.id}", role: "Record keeper", group: group_json(group), urgent: false,
                 title: "Minutes for #{held.held_on.strftime("%b %-d")} aren't posted", note: "Still a draft", href: "#{base}/meetings/#{held.id}" }
    end
    to_check = group.motions.where(needs_review: true).count
    items << { key: "check-#{group.id}", role: "Record keeper", group: group_json(group), urgent: false,
               title: "#{to_check} imported #{to_check == 1 ? "decision" : "decisions"} to check", note: "Look them over in Decisions", href: "#{base}/decisions" } if to_check.positive?
    ending_terms(group, today).each do |term|
      next if term.user_id == @viewer.id

      verb = term.ends_on < today ? "ended" : "ends"
      items << { key: "term-#{term.id}", role: "Record keeper", group: group_json(group), on: term.ends_on.iso8601, urgent: false,
                 title: "#{term.name}'s term as #{term.service_position.title} #{verb} #{term.ends_on.strftime("%b %-d")}",
                 note: "Time to find someone for it", href: "#{base}/officials" }
    end
    items
  end

  def treasurer_items(m)
    group = m.group
    base = "/groups/#{group.slug}/conscience/treasury"
    items = group.treasurer_reports.where(status: "draft").newest_first.limit(3).map do |r|
      { key: "report-#{r.id}", role: "Treasurer", group: group_json(group), urgent: false,
        title: "Treasurer's report for #{r.period_on.strftime("%B %Y")}", note: "Not posted yet", href: "#{base}/#{r.id}" }
    end
    # A group that keeps monthly reports here, with last month's not started
    last_month = group.zone.today.prev_month.beginning_of_month
    last = group.treasurer_reports.maximum(:period_on)
    if last && last < last_month
      items << { key: "report-due-#{group.id}", role: "Treasurer", group: group_json(group), urgent: false,
                 title: "No treasurer's report for #{last_month.strftime("%B")} yet", note: "Start one in Treasury", href: "#{base}/new" }
    end
    items
  end

  # Their own service terms ending in the next month (or ended with nobody after them)
  def term_items
    own_terms.map do |term|
      group = term.service_position.group
      verb = term.ends_on < group.zone.today ? "ended" : "ends"
      { key: "my-term-#{term.id}", role: term.service_position.title, group: group_json(group), on: term.ends_on.iso8601, urgent: false,
        title: "Your term as #{term.service_position.title} #{verb} #{term.ends_on.strftime("%b %-d")}",
        note: "Thank you for serving", href: "/groups/#{group.slug}/conscience/officials" }
    end
  end

  def own_terms
    @own_terms ||= ServiceTerm.where(user_id: @viewer.id).joins(:service_position)
                              .where(service_positions: { group_id: @by_group.keys, archived: false })
                              .includes(service_position: %i[group terms]).to_a
                              .select { |t| t.current?(t.service_position.group.zone.today) && t.ending_soon?(t.service_position.group.zone.today) }
  end

  def ending_terms(group, today)
    ServiceTerm.joins(:service_position).where(service_positions: { group_id: group.id, archived: false })
               .includes(service_position: :terms).to_a
               .select { |t| t.ends_on && t.ends_on >= today - 30 && t.ending_soon?(today) && t.service_position.current_term(today).in?([t, nil]) }
  end

  def soon?(request) = request.on <= request.meeting.group.zone.today + URGENT_DAYS - 1

  def cover_text(cover, original, mine, theirs)
    who = mine ? "You're" : "#{cover.name} is"
    for_whom = if theirs then " for you" elsif original then " for #{original.name}" end
    "#{who} filling in#{for_whom} as #{place(cover.role)} for the #{slot_label(cover.meeting)} meeting"
  end

  def place(role) = MeetingHost::ROLE_LABELS[role].downcase
  def role_label(role) = MeetingHost::ROLE_LABELS[role]
  def article(role) = role == "host" ? "the" : "a"

  # "9 AM Acid Test" for The Acid Test at 9:00 AM (a name that says "meeting" keeps it once:
  # the caller adds it)
  def slot_label(meeting)
    clock = Meeting.clock(meeting.start_minute).sub(":00", "")
    name = meeting.name.to_s.sub(/\Athe\s+/i, "").sub(/\s+meeting\z/i, "")
    "#{clock} #{name}"
  end

  def day_name(date, today)
    return "today" if date == today
    return "tomorrow" if date == today + 1

    date.strftime("%A, %b %-d")
  end

  def starts_at(meeting, date) = meeting.zone.local(date.year, date.month, date.day) + meeting.start_minute.to_i.minutes

  def ends_at(meeting, start)
    return start + 1.hour unless meeting.end_minute

    length = (meeting.end_minute - meeting.start_minute.to_i) % Meeting::DAY_MINUTES
    start + (length.zero? ? 60 : length).minutes
  end

  def group_json(group) = { slug: group.slug, title: group.title }
  def meetings_href(group) = "/groups/#{group.slug}/meetings"
end
