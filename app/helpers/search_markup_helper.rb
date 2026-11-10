# Structured data (schema.org JSON-LD) for the pages search engines may list (SearchEngines).
# A listed group's meetings carry only what newcomers need to find one: the group's name, when
# it meets and where. Never people: no hosts, members, notes (feeds' notes often name a
# contact), and the online link points at the meeting's page here, not the Zoom room.
module SearchMarkupHelper
  def search_base_url = Rails.env.production? ? "https://#{request.host}" : request.base_url

  def group_search_markup(group)
    base = search_base_url
    organizer = { "@type": "Organization", name: group.title, url: "#{base}/groups/#{group.slug}" }
    group.meetings.ordered.filter_map do |meeting|
      meeting_search_markup(meeting, organizer, base)
    rescue StandardError => e
      Rails.error.report(e, handled: true)
      nil
    end
  end

  # "Monday Night Big Book · Mondays, 7:00–8:00 PM MST · Online"
  def meeting_search_line(meeting)
    schedule = begin
      meeting.share_schedule_label
    rescue StandardError
      nil
    end
    [meeting.name, schedule, ("Online" if meeting.conference_url.present?), meeting.formatted_address.presence || meeting.location.presence].compact_blank.uniq.join(" · ")
  end

  def meeting_search_markup(meeting, organizer, base)
    start = meeting.next_start or return
    return if meeting.once? && start < Time.current

    url = "#{base}/groups/#{meeting.group.slug}/meetings/#{meeting.id}"
    online = meeting.conference_url.present?
    place = meeting.formatted_address.presence || meeting.location.presence
    return unless online || place

    locations = []
    locations << { "@type": "VirtualLocation", url: url } if online
    locations << { "@type": "Place", name: meeting.location.presence || place, address: place } if place

    event = {
      "@context": "https://schema.org", "@type": "Event",
      name: meeting.name.to_s.casecmp?(meeting.group.title) ? meeting.name : [meeting.name.presence, meeting.group.title].compact.join(" · "),
      url: url, startDate: start.iso8601, eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/#{online && place ? 'Mixed' : online ? 'Online' : 'Offline'}EventAttendanceMode",
      location: locations.one? ? locations.first : locations,
      organizer: organizer, isAccessibleForFree: true,
    }
    event[:endDate] = (start + meeting.duration_minutes.to_i.minutes).iso8601 if meeting.duration_minutes.to_i.positive?
    if meeting.weekly?
      event[:eventSchedule] = { "@type": "Schedule", repeatFrequency: "P1W", byDay: "https://schema.org/#{Date::DAYNAMES[meeting.day_of_week]}",
                                startTime: start.strftime("%H:%M"), scheduleTimezone: meeting.zone.tzinfo.name }
      event[:eventSchedule][:endTime] = (start + meeting.duration_minutes.to_i.minutes).strftime("%H:%M") if meeting.duration_minutes.to_i.positive?
    end
    event
  end
end
