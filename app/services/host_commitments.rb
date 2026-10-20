# A person's service as a host or co-host: the groups that let them host (marked "can host", or
# holding a place in the schedule), the meetings they hold a place in, and their coming dates.
# A date someone else covers isn't theirs; a date they cover for someone is.
class HostCommitments
  Commitment = Struct.new(:meeting, :role, :on, :starts_at, :cover, keyword_init: true)

  def initialize(user)
    @user = user
  end

  # Whether they're a host account at all (account settings and the nav ask this)
  def host? = @user.present? && memberships.any?

  # Their active memberships in groups where they can host or hold a place
  def memberships
    @memberships ||= begin
      held = Meeting.where(id: places.map(&:meeting_id)).distinct.pluck(:group_id)
      @user.group_memberships.active.includes(:group).select { |m| m.can_host || held.include?(m.group_id) }
    end
  end

  def groups = memberships.map(&:group)

  # The weekly meetings they hold a place in now or later (or cover a coming date of), with the
  # places: [[meeting, ["host"]], ...]
  def meetings
    @meetings ||= begin
      group_ids = memberships.map(&:group_id)
      roles = Hash.new { |h, k| h[k] = [] }
      places.each { |p| roles[p.meeting_id] |= [p.role] }
      Meeting.weekly.where(id: roles.keys, group_id: group_ids).includes(:group, :hosts, :host_covers).ordered
             .map { |m| [m, roles[m.id].sort_by { |r| MeetingHost::ROLES.index(r) }] }
    end
  end

  # Every date from `from` to `to` they're in a place, soonest first
  def upcoming(from: Time.current, to: from + 4.weeks)
    list = meetings.flat_map do |meeting, roles|
      roles.flat_map do |role|
        dates = []
        start = meeting.next_start(from)
        while start && start <= to
          held = meeting.holder_on(role, start.to_date)
          dates << Commitment.new(meeting: meeting, role: role, on: start.to_date, starts_at: start, cover: held.is_a?(MeetingHostCover)) if held&.user_id == @user.id
          start += 7.days
        end
        dates
      end
    end
    list.sort_by { |c| [c.starts_at, MeetingHost::ROLES.index(c.role)] }
  end

  # The same meeting on its several days is one line, for the court verification picker:
  # [{ group:, meeting: (one of its days), days: [0, 3], roles: }]
  def series
    meetings.group_by { |m, _| [m.group_id, m.name, m.start_minute, m.end_minute] }.values.map do |rows|
      { group: rows.first.first.group, meeting: rows.first.first, days: rows.map { |m, _| m.day_of_week }.sort, roles: rows.flat_map(&:last).uniq }
    end
  end

  private

  # Host assignments not over yet (a day's slack for time zones) and covers from yesterday on
  def places
    @places ||= begin
      since = Date.current - 1
      MeetingHost.where(user_id: @user.id).where("ends_on IS NULL OR ends_on >= ?", since).select(:meeting_id, :role).to_a +
        MeetingHostCover.where(user_id: @user.id).where("meeting_host_covers.on >= ?", since).select(:meeting_id, :role).to_a
    end
  end
end
