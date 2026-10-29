# Virtual chips, worked out from what a member has done (nothing is stored for an earned chip):
#
# - Round chips for sobriety milestones, from the sobriety date: 24 hours, 30, 60 and 90 days,
#   6, 9 and 18 months, and every year.
# - Triangle chips for how many 10th step inventories and gratitude lists they've written in
#   total (TRIANGLE_COUNTS), and for their best run of days in a row (STREAK_COUNTS).
# - Meeting Maker triangle chips, one series for each meeting, for each time they clicked Join
#   in the half hour before it started (MeetingJoin, MEETING_COUNTS).
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

  # Meeting Maker: each meeting they joined, its chips (a join counts once the meeting started),
  # each drawn as the meeting's chips looked on the day it was earned (minted chips never change)
  def meeting_chips(user, now = Time.current)
    joins = MeetingJoin.where(user: user).where(starts_at: ..now).includes(meeting: :group).order(:starts_at).group_by(&:meeting)
    versions = ChipDesignVersion.where(owner_type: "Meeting", owner_id: joins.keys.map(&:id)).order(:created_at, :id).group_by(&:owner_id)
    joins.flat_map do |meeting, list|
      info = { id: meeting.id, name: meeting.name, group_title: meeting.group.title }
      chip = lambda do |n, on, design, label|
        triangle("meeting-#{meeting.id}", n, on, label, meeting: info, design: design)
          .merge(kind: "meeting", series: "meeting-#{meeting.id}", shape: design.dig("meeting", "shape") || "triangle")
      end
      earned = counts(MEETING_COUNTS, list.size, 100).select { |n| n <= list.size }.map do |n|
        on = list[n - 1].starts_at.in_time_zone(meeting.zone).to_date
        chip.call(n, on, ChipDesign.for_meeting_on(meeting, on, versions[meeting.id] || []), "#{n} #{n == 1 ? 'meeting' : 'meetings'}")
      end
      upcoming = counts(MEETING_COUNTS, list.size, 100).find { |n| n > list.size }
      earned + [chip.call(upcoming, nil, ChipDesign.for_meeting(meeting), "#{upcoming} meetings").merge(upcoming: true, to_go: upcoming - list.size)]
    end
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
