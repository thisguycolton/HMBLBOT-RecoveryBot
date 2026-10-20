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
      kit: kit_json, can_edit: can_edit?, live: session.live_json(@viewer, @now), activity_options: activity_options,
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

  # The short link's page for people without an account: the meeting, and its chat postings filled
  # in for the day (HostingSession#public_json), or just the meeting when the kit keeps them to hosts
  def public_json
    host = @meeting.holder_on("host", @on)
    co_host = @meeting.holder_on("co_host", @on)
    shown = kit.nil? || kit.public_postings
    {
      group: { slug: @group.slug, title: @group.title, logo_url: @group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.logo, only_path: true) : nil },
      meeting: @meeting.as_api_json.slice(:id, :name, :schedule_label, :time_zone, :conference_url),
      on: @on.iso8601, starts_at: @starts_at&.iso8601, hosts: { host: host&.name, co_host: co_host&.name },
      shown: shown, can_host: @group.can_host?(@viewer), code: session.code,
      kit: { postings: shown && kit ? kit.postings.map(&:as_api_json) : [], service_roles: kit ? kit.roles : HostingKit::DEFAULT_SERVICE_ROLES },
      live: shown ? session.public_json(@now) : nil,
    }
  end

  private

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
                       .map { |d| { id: d.id, title: d.title, kind: d.kind, visibility: d.visibility } },
      books: @group.books.order(:title).map { |b| { slug: b.slug, title: b.title } },
    }
  end
end
