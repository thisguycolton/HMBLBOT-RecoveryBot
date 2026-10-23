# The Hosting Command Center for one of a group's meetings (/groups/:slug/host/:meeting_id), as
# JSON: which date it's for (the meeting on now, or its next one; it stays on a meeting for an hour
# after it ends), who hosts and co-hosts that day, the kit (HostingKit: the script, chat postings
# and readings), and the live state the host and co-host share (HostingSession).
class HostingCenter
  # How long after a meeting ends the Command Center stays on it before moving to the next one
  STICKY = 1.hour

  attr_reader :meeting, :on

  # `on`: a date the meeting runs (from a short link), instead of picking one
  def initialize(group, meeting, viewer, now: Time.current, on: nil)
    @group = group
    @viewer = viewer
    @now = now
    @meeting, @on, @starts_at, @ends_at = (on && occurrence_on(meeting, on)) || occurrence(meeting)
  end

  def kit = @kit ||= HostingKit.for(@meeting)

  def session
    @session ||= begin
      HostingSession.find_or_create_by!(meeting: @meeting, on: @on)
    rescue ActiveRecord::RecordNotUnique
      HostingSession.find_by!(meeting: @meeting, on: @on)
    end
  end

  def can_edit? = @group.hosts_editable_by?(@viewer)

  # Where the HostDeck's blocks go (HostingLayout), nil for the built-in "Host a meeting" template
  def layout = defined?(@layout) ? @layout : (@layout = HostingLayout.for(@meeting))

  # Changes whenever the arrangement does, so a deck that's open can say it was rearranged
  def layout_key = Digest::MD5.hexdigest(layout&.arrangement.to_json)[0, 12]

  def as_json(*)
    host = @meeting.holder_on("host", @on)
    co_host = @meeting.holder_on("co_host", @on)
    json = {
      group: { slug: @group.slug, title: @group.title, logo_url: @group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.logo, only_path: true) : nil },
      meeting: @meeting.as_api_json.slice(:id, :name, :schedule_label, :time_zone, :conference_url, :conference_url_notes),
      on: @on.iso8601, starts_at: @starts_at&.iso8601, ends_at: @ends_at&.iso8601,
      hosts: { host: host&.name, co_host: co_host&.name },
      my_role: [["host", host], ["co_host", co_host]].find { |_, h| h&.user_id && h.user_id == @viewer&.id }&.first,
      court_url: "/court_verifications/new?#{{ group: @group.slug, meeting: @meeting.id, host: (host || co_host)&.name }.compact.to_query}",
      kit: kit_json, can_edit: can_edit?, can_arrange: @group.decks_editable_by?(@viewer),
      layout: { arrangement: layout&.arrangement, scope: layout && (layout.default? ? "default" : "meeting"), key: layout_key },
      live: session.live_json(@viewer, @now), activity_options: activity_options, previous: previous_json,
      link: { code: session.code, path: session.link_path, public_postings: kit.nil? || kit.public_postings },
    }
    json[:editor] = editor_json if can_edit?
    json
  end

  # Every meeting the group has, once per series, for picking one
  def self.meetings_json(group, viewer)
    today = group.zone.today
    group.meetings.ordered.includes(:hosts, :host_covers).to_a
         .group_by { |m| m.weekly? ? [m.name, m.start_minute, m.end_minute] : [m.id] }
         .filter_map do |_, rows|
           soonest = rows.filter_map { |m| (u = m.upcoming) && [m, u.first] }.min_by(&:last)
           next if soonest.nil? && rows.first.once?

           m, start = soonest || [rows.first, nil]
           day = start&.to_date || today
           { id: m.id, name: m.name, days: rows.filter_map(&:day_of_week).sort, start_minute: m.start_minute, next_start: start&.iso8601,
             schedule_label: m.schedule_label, host: m.holder_on("host", day)&.name, co_host: m.holder_on("co_host", day)&.name,
             mine: [m.holder_on("host", day), m.holder_on("co_host", day)].any? { |h| h&.user_id && h.user_id == viewer&.id } }
         end
         .sort_by { |m| m[:next_start] || "9999" }
  end

  # The group's meetings day by day for the next `days` days (and the one on now, or ended within
  # STICKY), with who hosts each, for picking which meeting and date to open
  def self.occurrences_json(group, viewer, now: Time.current, days: 8)
    today = now.in_time_zone(group.zone).to_date
    group.meetings.includes(:hosts, :host_covers).to_a.flat_map do |m|
      next [] if m.once? && m.starts_at.nil?

      (today - 1..today + days - 1).filter_map do |day|
        start = m.start_on(day)
        next unless start

        finish = start + m.duration_minutes.minutes
        next if finish < now - STICKY

        host = m.holder_on("host", day)
        co_host = m.holder_on("co_host", day)
        { meeting_id: m.id, name: m.name, on: day.iso8601, starts_at: start.iso8601, ends_at: finish.iso8601, time_zone: m.time_zone,
          live: start <= now && now < finish, host: host&.name, co_host: co_host&.name,
          mine: [host, co_host].any? { |h| h&.user_id && h.user_id == viewer&.id } }
      end
    end.sort_by { |o| [o[:starts_at], o[:name]] }
  end

  # The Time Capsule: meetings the hosts ran from the Command Center, newest first, with what they
  # picked (the reading or activity, topics drawn), who did service, who celebrated and what the
  # hosts did. Dates nobody did anything on are left out.
  def self.capsule_json(group, meeting: nil, page: 1, per: 15)
    ids = meeting ? meeting.series.select(:id) : group.meetings.select(:id)
    scope = HostingSession.where(meeting_id: ids).where(on: ..group.zone.today)
                          .where("activity IS NOT NULL OR jsonb_array_length(log) > 0 OR jsonb_array_length(milestones) > 0 OR service <> '{}'::jsonb")
    sessions = scope.includes(meeting: %i[hosts host_covers]).order(on: :desc, id: :desc).offset((page - 1) * per).limit(per + 1).to_a
    roles = Hash.new { |h, m| h[m] = (HostingKit.for(m)&.roles || HostingKit::DEFAULT_SERVICE_ROLES).to_h { |r| [r["key"], r["label"]] } }
    {
      sessions: sessions.first(per).map do |s|
        m = s.meeting
        start = m.start_on(s.on)
        labels = roles[m]
        { id: s.id, on: s.on.iso8601, meeting: { id: m.id, name: m.name }, starts_at: start&.iso8601, time_zone: m.time_zone,
          hosts: { host: m.holder_on("host", s.on)&.name, co_host: m.holder_on("co_host", s.on)&.name },
          activity: s.activity, activity_label: s.activity_label,
          service: s.service.map { |key, name| { label: labels[key] || key.humanize, name: name } },
          milestones: s.milestones.map { |x| x.slice("name", "length", "done") }, posted: s.posted.size,
          log: s.log.map { |l| l.slice("by", "text", "at") } }
      end,
      more: sessions.size > per,
    }
  end

  # The short link's page for people without an account: the meeting, and its chat postings filled
  # in for the day (HostingSession#public_json), or just the meeting when the kit keeps them to hosts
  def public_json
    host = @meeting.holder_on("host", @on)
    co_host = @meeting.holder_on("co_host", @on)
    shown = kit.nil? || kit.public_postings
    {
      group: { slug: @group.slug, title: @group.title, logo_url: @group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.logo, only_path: true) : nil },
      meeting: @meeting.as_api_json.slice(:id, :name, :schedule_label, :time_zone, :conference_url, :conference_url_notes),
      on: @on.iso8601, starts_at: @starts_at&.iso8601, ends_at: @ends_at&.iso8601, hosts: { host: host&.name, co_host: co_host&.name },
      shown: shown, can_host: @group.can_host?(@viewer), code: session.code,
      kit: { postings: shown && kit ? kit.postings.map(&:as_api_json) : [], service_roles: kit ? kit.roles : HostingKit::DEFAULT_SERVICE_ROLES },
      live: shown ? public_live : nil,
    }
  end

  private

  # The live state for the short link's page. Who's celebrating goes along only when a chat posting
  # names them ({{ milestones }}), since the hosts paste that into the chat anyway.
  def public_live
    live = session.public_json(@now)
    live[:milestones_text] = session.milestones_text if kit&.postings&.any? { |p| p.body.to_s.match?(/\{\{\s*milestones\s*\}\}/) }
    live
  end

  # The meeting on a given date: whichever day of the series runs then (nil if none does)
  def occurrence_on(meeting, on)
    rows = meeting.weekly? ? meeting.series.to_a : [meeting]
    rows.each do |m|
      start = m.start_on(on)
      return [m, on, start, start + m.duration_minutes.minutes] if start
    end
    nil
  end

  # The day of the series to show: the one on now (or ended within STICKY), or the soonest coming
  def occurrence(meeting)
    rows = meeting.weekly? ? meeting.series.to_a : [meeting]
    soonest = rows.filter_map { |m| (u = m.upcoming(@now - STICKY)) && [m, *u] }.min_by { |_, start, _| start }
    return soonest.then { |m, start, finish| [m, start.to_date, start, finish] } if soonest

    start = meeting.once? ? meeting.starts_at&.in_time_zone(meeting.zone) : nil
    [meeting, start&.to_date || @group.zone.today, start, start && start + meeting.duration_minutes.minutes]
  end

  # What this meeting's hosts picked on its last few dates, so a topic or reading isn't repeated by mistake
  def previous_json
    HostingSession.where(meeting_id: @meeting.series.select(:id)).where(on: ...@on).where.not(activity: nil).order(on: :desc).limit(3).map do |s|
      { on: s.on.iso8601, label: s.activity_label, kind: s.activity["kind"], topics: Array(s.activity["topics"]).map { |t| t["title"] } }
    end
  end

  def kit_json
    script = kit&.script_document
    visible = script && GroupDocument.visible_to(@group, @viewer).exists?(id: script.id)
    {
      own: kit.present? && !kit.default?, exists: kit.present?,
      script: visible ? { id: script.id, title: script.title, body: script.body.to_s, body_format: script.body_format, updated_at: script.updated_at.iso8601 } : nil,
      script_hidden: !!script && !visible,
      postings: kit ? kit.postings.map(&:as_api_json) : [],
      readings: kit ? kit.readings : [],
      activity_anchor: kit&.activity_anchor,
      service_roles: kit ? kit.roles : HostingKit::DEFAULT_SERVICE_ROLES,
      custom_service_roles: kit&.service_roles.present?,
      allowed_values: kit&.allowed_values,
    }
  end

  # What the hosts pick the day's reading or activity from: the page for this date in each daily
  # book ("october-20" in Daily Reflections, The Language of Letting Go...), the group's literature
  # (or the whole library when it has none), and the Topicificator's topic sets
  def activity_options
    slug = "#{Date::MONTHNAMES[@on.month].downcase}-#{@on.day}"
    daily = Chapter.joins(:book).merge(Book.visible_to(@viewer)).where(slug: slug).includes(:book).order("books.title")
                   .map { |c| { book_slug: c.book.slug, book_title: c.book.title, chapter_slug: c.slug, title: c.title } }
    books = @group.books.merge(Book.visible_to(@viewer)).order(:title).to_a
    books = Book.visible_to(@viewer).order(:title).to_a if books.empty?
    { daily: daily, books: books.map { |b| { slug: b.slug, title: b.title } }, topic_sets: TopicSet.order(:name).map { |t| { id: t.id, name: t.name } } }
  end

  # What a host coordinator picks from: documents hosts can read, and the group's literature
  def editor_json
    default = @group.hosting_kits.find_by(meeting_id: nil)
    {
      script_document_id: kit&.script_document_id, has_default: default.present?,
      documents: @group.documents.where(status: "current", visibility: %w[public members hosts]).order(Arel.sql("kind = 'format' DESC"), :title)
                       .map { |d| { id: d.id, title: d.title, kind: d.kind, visibility: d.visibility, sections: HostingKit.section_count(d) } },
      books: @group.books.order(:title).map { |b| { slug: b.slug, title: b.title } },
    }
  end
end
