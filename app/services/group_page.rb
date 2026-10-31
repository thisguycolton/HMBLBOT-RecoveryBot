# What a group page shows, for the page (/groups/:slug) and the HMBLBOT Editor
# (/groups/:slug/page/edit): its layout and blocks (its own, or the default page's) and,
# as `context`, the group data its own blocks list (EventBlocks::GROUP_TYPES).
#
# An AA Intergroup group that isn't here yet gets the default page filled in from its
# listings (#intergroup_json), and the default page's editor shows it with a made-up group
# (#template_json). Members' things (members, readings, the timeline) are only there for
# members; everyone else gets nil for those and a count of members.
class GroupPage
  TIMELINE_MAX = 20
  MEMBERS_MAX = 48
  DOCUMENTS_MAX = 60
  DECISIONS_MAX = 40

  def initialize(viewer)
    @viewer = viewer
  end

  def group_json(group)
    template = GroupPageTemplate.current
    membership = group.membership_for(@viewer)
    member = @viewer&.suite_admin? || membership&.active?
    page(
      kind: "group",
      layout: group.custom_page? ? group.page_layout : template.layout,
      blocks: group.custom_page? ? group.page_blocks : template.blocks,
      custom: group.custom_page?,
      cover_url: image_path(group.cover),
      can_edit: group.manageable_by?(@viewer),
      upload_path: "/groups/#{group.slug}/page/images",
      context: {
        group: { slug: group.slug, title: group.title, description: group.description, website: group.website,
                 time_zone: group.time_zone, status: group.status, members_count: group.members.count },
        viewer: viewer_json.merge(is_member: !!membership&.active?, membership_status: membership&.status, role: membership&.role,
                                  can_manage: group.manageable_by?(@viewer), can_keep_records: group.records_editable_by?(@viewer), default_note_visibility: @viewer&.default_note_visibility),
        meetings: meetings(group),
        events: group.events.published.not_past.with_attached_cover
                     .upcoming_first.limit(20).map(&:card_json),
        literature: literature(group),
        readings: member ? readings(group) : nil,
        documents: documents(group),
        decisions: decisions(group),
        business_meeting: business_meeting(group),
        members: member ? members(group) : nil,
        timeline: member ? group.shared_notes.not_blocked_by(@viewer).for_feed.limit(TIMELINE_MAX).map { |n| n.as_api_json(viewer: @viewer, group: group) } : nil,
      }
    )
  end

  # `listings`: the OiaaMeeting rows filed under one group name (OiaaMeeting.for_group)
  def intergroup_json(listings, slug:)
    template = GroupPageTemplate.current
    first = listings.first
    page(
      kind: "intergroup",
      layout: template.layout,
      blocks: template.blocks,
      custom: false,
      cover_url: image_path(template.cover),
      can_edit: false,
      context: {
        group: { title: first.group_name.presence || first.name, time_zone: first.zone.tzinfo.name, members_count: 0,
                 source: first.source_name, source_url: first.url.presence || first.meeting_directory&.website },
        oiaa_slug: slug,
        viewer: viewer_json,
        meetings: listings.map { |r| listing_json(r) },
        events: [], literature: [], readings: nil, documents: [], decisions: [], business_meeting: nil, members: nil, timeline: nil,
      }
    )
  end

  # The default page in its editor, with a made-up group so its blocks have something to show
  def template_json
    template = GroupPageTemplate.current
    page(
      kind: "template",
      layout: template.layout,
      blocks: template.blocks,
      custom: true,
      cover_url: image_path(template.cover),
      can_edit: !!@viewer&.suite_admin?,
      upload_path: "/group_page_template/images",
      updated_at: template.updated_at.iso8601,
      updated_by: template.updated_by&.display_name,
      context: {
        group: { title: "Sunrise Group", time_zone: "America/Phoenix", members_count: 12 },
        sample: true,
        viewer: viewer_json,
        meetings: [
          { id: "sample-1", name: "Sunrise Group", schedule_label: "Mondays, Wednesdays, Fridays, 7:00 AM MST", types: %w[O D], conference_url: "https://zoom.us/",
            hosts: [{ role: "host", name: "Sam R." }, { role: "co_host", name: "Alex P." }] },
          { id: "sample-2", name: "Sunrise Big Book Study", schedule_label: "Saturdays, 9:00 AM MST", types: %w[C B], conference_url: "https://zoom.us/" },
        ],
        events: [], literature: [], readings: nil, documents: [], members: nil, timeline: nil,
      }
    )
  end

  private

  def page(**json)
    json.merge(signed_in: @viewer.present?, can_edit_default: !!@viewer&.suite_admin?, timeline_max: TIMELINE_MAX,
               note_max: TimelineNote::BODY_MAX)
  end

  def viewer_json
    { signed_in: @viewer.present?, can_start: Group.feature_open_to?(@viewer), is_member: false }
  end

  # Its meetings still to come, each with who hosts and co-hosts it next (or now, while it's on)
  # unless the group turned that off in its settings; a name connected to an account links to
  # their profile for people who can see profiles
  def meetings(group)
    list = group.meetings.ordered
    list = list.includes(hosts: :user, host_covers: :user) if group.show_hosts_publicly
    profiles = User.profiles_open_to?(@viewer)
    list.filter_map do |m|
      json = m.as_api_json
      next if json[:past]

      date = (m.upcoming&.first || m.next_start)&.to_date if group.show_hosts_publicly && m.weekly?
      if date
        json[:hosts] = MeetingHost::ROLES.filter_map do |role|
          held = m.holder_on(role, date) or next
          { role: role, name: held.name, username: (held.user.username if profiles && held.user) }.compact
        end
        json[:hosts_on] = date.iso8601
      end
      json
    end
  end

  def literature(group)
    group.group_books.includes(book: { cover_image_attachment: :blob }).order(:created_at).map do |gb|
      { id: gb.id, note: gb.note, book: { slug: gb.book.slug, title: gb.book.title, author: gb.book.author, cover_url: gb.book.cover_url, cover_color: gb.book.cover_color } }
    end
  end

  # Documents this viewer may see (Public ones for visitors); each block filters them again
  def documents(group)
    GroupDocument.visible_to(group, @viewer).with_attached_file.ordered.limit(DOCUMENTS_MAX)
                 .map { |d| d.as_api_json.slice(:id, :title, :kind, :pinned, :excerpt, :updated_at, :file) }
  end

  # Standing decisions this viewer may see (Public ones for visitors); each block filters them again
  def decisions(group)
    Motion.visible_to(group, @viewer).standing.newest_first.limit(DECISIONS_MAX).map do |m|
      m.as_api_json(replacers: {}).slice(:id, :title, :category, :decided_on, :votes_for, :votes_against, :abstentions)
    end
  end

  # The next business meeting, as far as this viewer may know of it: members get its agenda and
  # can suggest an item; anyone else only hears of it when a published event announces it
  def business_meeting(group)
    meeting = BusinessMeeting.next_for(group, @viewer)
    if meeting
      items = meeting.agenda_items.where(status: %w[on_agenda tabled done]).map { |i| i.as_api_json.slice(:id, :kind, :title, :status) }
      return meeting.as_api_json.slice(:id, :held_on, :when_label, :event).merge(agenda: items, can_suggest: true)
    end

    announced = group.business_meetings.where(status: "planned").where("held_on >= ?", group.zone.today)
                     .joins(:event).where(events: { status: "published" }).order(:held_on).first
    announced && announced.as_api_json.slice(:held_on, :when_label, :event)
  end

  def readings(group)
    group.shared_readings.includes(user: { avatar_attachment: :blob }).limit(20).map do |r|
      { id: r.id, title: r.title, meeting_date: r.meetingDate&.iso8601, published_at: r.published_at&.iso8601, author: r.user&.as_member_json }
    end
  end

  def members(group)
    group.active_memberships.includes(user: { avatar_attachment: :blob }).sort_by { |m| [m.admin? ? 0 : 1, m.user.display_name.downcase] }
         .first(MEMBERS_MAX).map { |m| m.user.as_member_json.merge(role: m.role) }
  end

  def listing_json(record)
    upcoming = record.upcoming
    { id: record.slug, name: record.name, schedule_label: record.schedule_label, types: record.types,
      conference_url: record.conference_url, conference_url_notes: record.conference_url_notes,
      time_zone: record.zone.tzinfo.name, oiaa_url: record.url,
      location: record.location, formatted_address: record.formatted_address, location_notes: record.location_notes, **record.map_json,
      upcoming_start: upcoming&.first&.iso8601, upcoming_end: upcoming&.last&.iso8601 }
  end

  def image_path(attachment)
    return unless attachment.attached?

    Rails.application.routes.url_helpers.rails_storage_proxy_path(attachment, only_path: true)
  end
end
