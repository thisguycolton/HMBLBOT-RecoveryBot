# What a profile page (/people/:username) shows, for the page and its HMBLBOT Editor
# (/people/me/edit): its owner's layout and blocks (theirs, or DEFAULT_BLOCKS until they
# save their own) and, as `context`, what its own blocks list (EventBlocks::PROFILE_TYPES):
# their notes and highlights as far as the viewer may see them (Visibility), the groups
# they share with the viewer, and who they follow and who follows them.
#
# Profiles are only for signed-in people who can use Groups (User.profiles_open_to?);
# nothing here is ever public on the web.
class ProfilePage
  FEED_MAX = 40
  PEOPLE_MAX = 48

  DEFAULT_LAYOUT = "main_side"
  DEFAULT_BLOCKS = [
    { "type" => "feed", "region" => "main" },
    { "type" => "about", "region" => "side" },
    { "type" => "groups", "region" => "side" },
    { "type" => "people", "region" => "side", "which" => "following" },
  ].freeze

  def self.default_blocks = EventBlocks.normalize(DEFAULT_BLOCKS.map(&:dup), types: EventBlocks::PROFILE_TYPES)

  def initialize(viewer)
    @viewer = viewer
  end

  def person_json(person)
    me = @viewer&.id == person.id
    {
      kind: "person",
      layout: person.custom_page? ? person.page_layout : DEFAULT_LAYOUT,
      blocks: person.custom_page? ? person.page_blocks : self.class.default_blocks,
      custom: person.custom_page?,
      cover_url: image_path(person.profile_cover),
      can_edit: me,
      upload_path: ("/profile_page/images" if me),
      note_max: TimelineNote::BODY_MAX,
      images_max: TimelineNote::IMAGES_MAX,
      context: {
        person: person.as_member_json.merge(
          followers_count: person.follows_received.count, following_count: person.follows_given.count,
          joined: person.created_at.to_date.iso8601, path: person.profile_path
        ),
        viewer: {
          signed_in: @viewer.present?, is_me: me, following: !me && !!@viewer&.following?(person),
          follows_you: !me && !!person.following?(@viewer),
          # Writing a note on their page (TimelineNote#profile)
          can_write_note: !me && TimelineNote.writable_on_profile?(@viewer, person),
          default_note_visibility: (@viewer.default_note_visibility if me),
          # Groups their notes can go to, for the note composer
          groups: (me ? @viewer.groups.order(:title).map { |g| { slug: g.slug, title: g.title } } : nil),
        },
        feed: feed(person),
        groups: groups(person, me),
        following: people(person.following),
        followers: people(person.followers),
        # Their favorite chips, when their page has a Chips block (Chips.favorites)
        chips: person.show_chips_on_profile ? Chips.favorites(person) : [],
        chips_path: ("/recovery" if me),
        chip_design: ChipDesign::DEFAULT,
      },
    }
  end

  # The viewer's own notes and shared highlights and what people they follow shared with
  # followers or members, newest first (the home page, /people)
  def following_feed(before: nil)
    ids = @viewer.follows_given.select(:followed_id)
    shared = %w[followers public]
    notes = TimelineNote.where(user_id: ids, visibility: shared, profile_id: nil).shown
                        .or(TimelineNote.where(profile_id: ids, visibility: shared).shown)
                        .or(TimelineNote.where(user_id: @viewer.id)).or(TimelineNote.where(profile_id: @viewer.id))
    highlights = UserHighlight.on_timeline.where(user_id: ids, visibility: shared).or(UserHighlight.on_timeline.where(user_id: @viewer.id))
    merge(notes, highlights, before: before)
  end

  def feed(person, before: nil)
    own = TimelineNote.visible_to(@viewer, owner: person).where(profile_id: nil)
    own = own.shown unless @viewer&.id == person.id
    # with the notes others wrote on their page
    notes = TimelineNote.where(id: own.select(:id)).or(TimelineNote.where(id: TimelineNote.on_profile_seen_by(@viewer, person).select(:id)))
    merge(notes, UserHighlight.visible_to(@viewer, owner: person).on_timeline, before: before)
  end

  # Followers or following, newest first
  def people(scope, limit: PEOPLE_MAX)
    scope.includes(avatar_attachment: :blob).order("follows.created_at DESC").limit(limit).map(&:as_person_json)
  end

  private

  def merge(notes, highlights, before: nil)
    if before
      notes = notes.where(created_at: ...before)
      highlights = highlights.where(shared_at: ...before)
    end
    notes = notes.for_feed.newest_first.limit(FEED_MAX)
    highlights = highlights.includes(chapter: :book, user: { avatar_attachment: :blob }).order(shared_at: :desc, id: :desc).limit(FEED_MAX)
    (notes.map { |n| n.as_api_json(viewer: @viewer) } + highlights.map { |h| h.as_feed_json(viewer: @viewer) })
      .sort_by { |item| item[:created_at] }.reverse.first(FEED_MAX)
  end

  # Their own groups, for themselves; for anyone else only the groups they're both in
  def groups(person, me)
    scope = person.groups.order(:title)
    scope = scope.where(id: @viewer.groups.select(:id)) unless me || @viewer&.suite_admin?
    list = scope.includes(logo_attachment: :blob).to_a
    counts = GroupMembership.active.where(group_id: list.map(&:id)).group(:group_id).count
    list.map do |g|
      { slug: g.slug, title: g.title, description: g.description, logo_url: image_path(g.logo), members_count: counts[g.id] || 0 }
    end
  end

  def image_path(attachment)
    return unless attachment.attached?

    Rails.application.routes.url_helpers.rails_storage_proxy_path(attachment, only_path: true)
  end
end
