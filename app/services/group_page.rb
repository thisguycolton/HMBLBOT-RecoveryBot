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
                                  can_manage: group.manageable_by?(@viewer), default_note_visibility: @viewer&.default_note_visibility),
        meetings: group.meetings.ordered.map(&:as_api_json).reject { |m| m[:past] },
        events: group.events.published.with_attached_cover.where("starts_at IS NULL OR starts_at > ?", 12.hours.ago)
                     .upcoming_first.limit(20).map(&:card_json),
        literature: literature(group),
        readings: member ? readings(group) : nil,
        members: member ? members(group) : nil,
        timeline: member ? group.shared_notes.limit(TIMELINE_MAX).map { |n| n.as_api_json(viewer: @viewer, group: group) } : nil,
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
        group: { title: first.group_name.presence || first.name, time_zone: first.zone.tzinfo.name, members_count: 0 },
        oiaa_slug: slug,
        viewer: viewer_json,
        meetings: listings.map { |r| listing_json(r) },
        events: [], literature: [], readings: nil, members: nil, timeline: nil,
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
          { id: "sample-1", name: "Sunrise Group", schedule_label: "Mondays, Wednesdays, Fridays, 7:00 AM MST", types: %w[O D], conference_url: "https://zoom.us/" },
          { id: "sample-2", name: "Sunrise Big Book Study", schedule_label: "Saturdays, 9:00 AM MST", types: %w[C B], conference_url: "https://zoom.us/" },
        ],
        events: [], literature: [], readings: nil, members: nil, timeline: nil,
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

  def literature(group)
    group.group_books.includes(book: { cover_image_attachment: :blob }).order(:created_at).map do |gb|
      { id: gb.id, note: gb.note, book: { slug: gb.book.slug, title: gb.book.title, author: gb.book.author, cover_url: gb.book.cover_url, cover_color: gb.book.cover_color } }
    end
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
    { id: record.slug, name: record.name, schedule_label: record.schedule_label, types: record.types,
      conference_url: record.conference_url, time_zone: record.zone.tzinfo.name, oiaa_url: record.url }
  end

  def image_path(attachment)
    return unless attachment.attached?

    Rails.application.routes.url_helpers.rails_storage_proxy_path(attachment, only_path: true)
  end
end
