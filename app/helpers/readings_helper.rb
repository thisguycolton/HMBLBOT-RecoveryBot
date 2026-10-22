module ReadingsHelper
  # The reading's group, as its page shows it: { name, url }, or nil when it has none the
  # viewer can see
  def reading_group_link(reading, user)
    group = reading.group
    return unless group&.page_visible_to?(user)

    { name: group.title.to_s, url: "/groups/#{group.slug}" }
  end

  # The Hosting Command Center for the reading's meeting, for someone who can host it: the
  # group's meeting on the reading's date nearest its time, else the picker of meetings
  def reading_host_url(reading, user)
    group = reading.group
    return unless user && group&.can_host?(user)

    meeting = reading_meeting(reading, group)
    return "/groups/#{group.slug}/host" unless meeting

    "/groups/#{group.slug}/host/#{meeting.id}?on=#{reading.meetingDate.iso8601}"
  end

  private

  def reading_meeting(reading, group)
    date = reading.meetingDate
    return unless date

    minute = reading.meetingTime && (reading.meetingTime.hour * 60 + reading.meetingTime.min)
    candidates = group.meetings.select do |m|
      m.weekly? ? m.day_of_week == date.wday : m.starts_at&.in_time_zone(m.zone)&.to_date == date
    end
    return candidates.first if minute.nil? || candidates.size < 2

    candidates.min_by do |m|
      start = m.weekly? ? m.start_minute : m.starts_at.in_time_zone(m.zone).then { |t| t.hour * 60 + t.min }
      (start.to_i - minute).abs
    end
  end
end
