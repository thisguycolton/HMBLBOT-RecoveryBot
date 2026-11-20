module ReadingsHelper
  # The reading's group, as its page shows it: { name, url, logo_url, cover_url }, or nil
  # when it has none the viewer can see
  def reading_group_link(reading, user)
    group = reading.group
    return unless group&.page_visible_to?(user)

    { name: group.title.to_s, url: "/groups/#{group.slug}",
      logo_url: group.logo.attached? ? rails_storage_proxy_path(group.logo, only_path: true) : nil,
      cover_url: group.cover.attached? ? rails_storage_proxy_path(group.cover, only_path: true) : nil }
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

  # Its source link and Grapevine credit for its page and cards, and whether its words are held
  # back from this viewer (a Grapevine reading outside its public window: Reading#full_text_for?)
  def reading_source_json(reading, user)
    grapevine = reading.grapevine?
    locked = !reading.full_text_for?(user)
    {
      source_url: reading.source_url.presence,
      grapevine: grapevine,
      grapevine_search: reading.grapevine_search_link?,
      # A Grapevine reading with no link yet still gets one: a search for its title
      read_on_url: reading.source_url.presence || (Reading.grapevine_search_url(reading.title) if grapevine),
      text_locked: locked,
      excerpt: (reading.excerpt if locked),
      # Shown to whoever sees the whole thing because they're in the group, so they know the public doesn't
      public_until: (reading.public_text_until&.iso8601 if grapevine && !locked),
      public_now: grapevine ? reading.public_text_open? : true,
    }
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
