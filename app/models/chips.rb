# Virtual chips, worked out from what a member has done (nothing is stored for an earned chip):
#
# - Round chips for sobriety milestones, from the sobriety date: 24 hours, 30, 60 and 90 days,
#   6, 9 and 18 months, and every year.
# - Triangle chips for how many 10th step inventories and gratitude lists they've written in
#   total (TRIANGLE_COUNTS), and for their best run of days in a row (STREAK_COUNTS).
# - Meeting Maker triangle chips for each time they clicked Join in the half hour before a meeting
#   started (MeetingJoin, MEETING_COUNTS): a series for each meeting (by name, in its group), for
#   each group's meetings together, and for all of them.
#
# - Special Editions (ChipEdition) a group made for a window of time: milestone ones a member
#   claimed (or a host gave, on the ChipAward), Meeting Maker ones they earned; and the ones
#   they can claim (ChipEdition.available_for).
#
# Earned chips are RecoveryBot's own design (ChipDesign.for_site, as it was when earned). Round
# chips a group's hosts give (ChipAward) are drawn in that group's design, and a Meeting Maker
# series in its meeting's.
# Each chip has an id, and a slot: the milestone it marks. When two chips mark the same one (the
# 1 year they earned and the 1 year their group gave them), the member picks which goes on top
# (users.chip_tops), and up to five favorites can go on their profile (users.chip_favorites).
module Chips
  TRIANGLE_COUNTS = [1, 7, 30, 90, 180, 365].freeze
  STREAK_COUNTS = [7, 30, 90, 180, 365].freeze
  MEETING_COUNTS = [1, 5, 10, 25, 50, 100].freeze
  FAVORITES = 5
  ENTRY_KINDS = {
    "inventory" => { model: "StepInventory", label: "10th step", plural: "10th steps", streak: "nights in a row" },
    "gratitude" => { model: "GratitudeList", label: "gratitude list", plural: "gratitude lists", streak: "days in a row" },
  }.freeze

  module_function

  # The counts with a chip in a series, up to and one past `total`; after the listed ones,
  # one every `step` (a year's worth, or a hundred meetings)
  def counts(list, total, step = 365)
    out = list.dup
    out << out.last + step while out.last <= total
    out
  end

  def triangle_counts(total) = counts(TRIANGLE_COUNTS, total)
  def next_count(total) = triangle_counts(total).find { |n| n > total }

  # The sobriety milestones from `start`: those reached by `today` (oldest first) and the next
  def round_milestones(start, today)
    list = [{ key: "24h", label: "24 hours", on: start + 1 }]
    [30, 60, 90].each { |n| list << { key: "#{n}d", label: "#{n} days", on: start + n } }
    [6, 9, 18].each { |n| list << { key: "#{n}m", label: "#{n} months", on: start >> n } }
    (1..(today.year - start.year + 2)).each { |y| list << { key: "year", years: y, label: "#{y} year#{'s' unless y == 1}", on: start >> (12 * y) } }
    list.sort_by! { |m| m[:on] }
    { earned: list.select { |m| m[:on] <= today }, next: list.find { |m| m[:on] > today } }
  end

  def round_slot(key, years) = key == "year" ? "round:year-#{years}" : "round:#{key}"

  # Runs of days in a row in these dates: the current one (alive through yesterday, so tonight's
  # still counts), the best, and the day each streak chip was reached
  def streaks(days, today)
    days = days.uniq.sort
    best = run = 0
    earned = []
    days.each_with_index do |day, i|
      run = i.positive? && days[i - 1] == day - 1 ? run + 1 : 1
      next unless run > best

      best = run
      earned << { count: run, on: day } if counts(STREAK_COUNTS, run).include?(run)
    end
    current = days.any? && days.last >= today - 1 ? run : 0
    { current: current, best: best, earned: earned, next: counts(STREAK_COUNTS, best).find { |n| n > best } }
  end

  # The total and streak chips for 10th steps or gratitude lists
  def entry_chips(user, kind, today)
    info = ENTRY_KINDS.fetch(kind)
    days = info[:model].constantize.where(user: user).order(:on).pluck(:on)
    totals = triangle_counts(days.size).select { |n| n <= days.size }.map do |n|
      triangle(kind, n, days[n - 1], "#{n} #{n == 1 ? info[:label] : info[:plural]}")
    end
    streak = streaks(days, today)
    streak_chips = streak[:earned].map { |c| triangle("#{kind}-streak", c[:count], c[:on], "#{c[:count]} #{info[:streak]}") }
    {
      chips: totals + streak_chips, total: days.size, streak: streak.slice(:current, :best),
      next: [
        triangle(kind, next_count(days.size), nil, "#{next_count(days.size)} #{info[:plural]}").merge(to_go: next_count(days.size) - days.size),
        triangle("#{kind}-streak", streak[:next], nil, "#{streak[:next]} #{info[:streak]}").merge(to_go: streak[:next] - streak[:current]),
      ],
    }
  end

  def triangle(kind, count, on, label, extra = {})
    { id: "#{kind}:#{count}", slot: "#{kind}:#{count}", shape: "triangle", kind: kind, count: count, label: label, on: on&.iso8601, source: "earned" }.merge(extra)
  end

  # Meeting Maker: their meetings counted three ways, each its own series of chips (a join
  # counts once the meeting started): all of them anywhere, all of a group's, and each meeting.
  # A meeting held on several days is often one record a day with the same name (The Acid Test,
  # every day), so those count as one meeting, under the group's lowest-id one so its chip ids
  # stay put as they join on other days. A group's count only shows when they've been to more
  # than one of its meetings, and the count of all of them when they've been to more than one
  # meeting, so the same chips never show twice.
  # Each chip is drawn as it looked on the day it was earned (minted chips never change): a
  # meeting's in that day's meeting's design, a group's in the group's, all of them in
  # RecoveryBot's.
  def meeting_chips(user, now = Time.current)
    joins = MeetingJoin.where(user: user).where(starts_at: ..now).includes(meeting: :group).order(:starts_at).to_a
    return [] if joins.empty?

    versions = ChipDesignVersion.where(owner_type: "Meeting", owner_id: joins.map(&:meeting_id).uniq).order(:created_at, :id).group_by(&:owner_id)
    series = meeting_series(joins.map(&:meeting).uniq)
    by_meeting = joins.group_by { |j| series[j.meeting_id] }
    out = []
    if by_meeting.size > 1
      site = ChipDesign.site_versions
      out.concat(meeting_series_chips("meetings-all", { id: "all", scope: "all", name: "All meetings" }, joins) do |on|
        with_meeting_name((on && ChipDesign.for_site_on(on, site)) || ChipDesign.for_site, "All meetings")
      end)
    end
    by_meeting.group_by { |main, _| main.group }.each do |group, meetings|
      if meetings.size > 1
        list = meetings.flat_map(&:last).sort_by(&:starts_at)
        out.concat(meeting_series_chips("meetings-group-#{group.id}", { id: "group-#{group.id}", scope: "group", name: "All meetings", group_title: group.title }, list) do |on|
          with_meeting_name((on && ChipDesignVersion.on(group, on)) || ChipDesign.for_group(group), group.title)
        end)
      end
      meetings.each do |main, list|
        out.concat(meeting_series_chips("meeting-#{main.id}", { id: main.id, scope: "meeting", name: main.name, group_title: group.title }, list) do |on, join|
          on ? ChipDesign.for_meeting_on(join.meeting, on, versions[join.meeting_id] || []) : ChipDesign.for_meeting(list.last.meeting)
        end)
      end
    end
    out
  end

  # A series' chips earned from these joins (oldest first) and the next one; the block gives the
  # design for the day one was earned (nil: the next one) and the join it was earned at
  def meeting_series_chips(series, info, joins)
    total = joins.size
    chip = lambda do |n, on, design, label|
      triangle(series, n, on, label, meeting: info, design: design)
        .merge(kind: "meeting", series: series, shape: design.dig("meeting", "shape") || "triangle")
    end
    earned = counts(MEETING_COUNTS, total, 100).select { |n| n <= total }.map do |n|
      join = joins[n - 1]
      on = join.starts_at.in_time_zone(join.meeting.zone).to_date
      chip.call(n, on, yield(on, join), "#{n} #{n == 1 ? 'meeting' : 'meetings'}")
    end
    upcoming = counts(MEETING_COUNTS, total, 100).find { |n| n > total }
    earned + [chip.call(upcoming, nil, yield(nil, joins.last), "#{upcoming} meetings").merge(upcoming: true, to_go: upcoming - total)]
  end

  # The design with `name` along a Meeting Maker chip's third side, unless it has its own
  def with_meeting_name(design, name)
    design = design.deep_dup
    sides = design.dig("meeting", "sides")
    sides[2] = name.to_s.first(24) if sides.is_a?(Array) && sides[2].blank?
    design
  end

  # Each of these meetings' series: the lowest-id meeting in its group with the same name
  # (a meeting with no name is a series of its own), by meeting id
  def meeting_series(meetings)
    key = ->(m) { m.name.to_s.squish.downcase.presence }
    mains = Meeting.where(group_id: meetings.map(&:group_id).uniq).order(:id).includes(:group)
      .each_with_object({}) { |m, by| by[[m.group_id, key.call(m)]] ||= m if key.call(m) }
    meetings.to_h { |m| [m.id, (key.call(m) && mains[[m.group_id, key.call(m)]]) || m] }
  end

  # Every chip a member has, and the next one in each series (upcoming: true), for the Chips
  # page and their profile. Chips with no design of their own use the response's `design`.
  def catalog(user, today = Date.current)
    chips = []
    upcoming = []
    if user.sobriety_date
      round = round_milestones(user.sobriety_date, today)
      # Each in RecoveryBot's design from the day it was earned (none: the plain default)
      versions = ChipDesign.site_versions
      round[:earned].each { |m| chips << round_chip(m, ChipDesign.for_site_on(m[:on], versions)) }
      upcoming << round_chip(round[:next], versions.last&.design).merge(upcoming: true, to_go: (round[:next][:on] - today).to_i) if round[:next]
    end
    user.chip_awards.claimed.includes(:given_by, :edition_chip, :chip_edition, group: { logo_attachment: :blob }).find_each { |a| chips << a.as_chip_json }
    ChipEdition.award_meeting_makers(user)
    ChipEditionChip.claimed.where(user: user, chip_award_id: nil).includes(chip_edition: { group: { logo_attachment: :blob } }).find_each { |c| chips << c.as_chip_json }

    streaks = {}
    totals = {}
    ENTRY_KINDS.each_key do |kind|
      e = entry_chips(user, kind, today)
      chips.concat(e[:chips])
      upcoming.concat(e[:next].map { |c| c.merge(upcoming: true) })
      streaks[kind] = e[:streak]
      totals[kind] = e[:total]
    end
    meeting = meeting_chips(user)
    chips.concat(meeting.reject { |c| c[:upcoming] })
    upcoming.concat(meeting.select { |c| c[:upcoming] })

    { chips: chips, upcoming: upcoming, streaks: streaks, totals: totals }
  end

  def round_chip(m, design = nil)
    { id: round_slot(m[:key], m[:years]), slot: round_slot(m[:key], m[:years]), shape: "round", kind: "round",
      milestone: m.slice(:key, :years, :label), label: m[:label], on: m[:on].iso8601, source: "earned", design: design }.compact
  end

  # The chips in the order a member wants them: their pick on top of each slot
  def ordered(chips, tops)
    chips.group_by { |c| c[:slot] }.flat_map do |slot, list|
      top = tops[slot]
      list.sort_by { |c| c[:id] == top ? 0 : 1 }.each_with_index.map { |c, i| c.merge(top: i.zero?, others: list.size - 1) }
    end
  end

  # Their favorites, in the order they chose them, for their profile
  def favorites(user, today = Date.current)
    by_id = catalog(user, today)[:chips].index_by { |c| c[:id] }
    user.chip_favorites.filter_map { |id| by_id[id] }.first(FAVORITES)
  end
end
