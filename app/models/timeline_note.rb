# A note on its author's timeline, on their profile (/people/:username). Notes are
# Markdown, like the notes on highlights, and can hold pictures. `visibility` says who
# sees it on the profile (Visibility); sharing it to groups they're in also shows it to
# that group's members in the group page's Timeline block. A group's admins can take a
# note off their group's timeline.
#
# People who can see a note react to it (NoteReaction), comment on it (NoteComment) and
# can repost it to their own
# timeline. A repost is a note of theirs that shows the original (`repost_of`) with its
# author's name. Only notes their author shares with Members can be reposted, so a repost
# never shows a note to anyone its author didn't; when the author narrows who sees it (or
# deletes it), its reposts go.
#
# The #hashtags in its words (Hashtags) are kept in `hashtags`: each tag has a page listing
# the notes the viewer can see that have it (/people/tags/:tag, Api::HashtagsController).
#
# A note can carry one of its author's chips (Share to timeline on a chip): `chip_id` names it
# as Chips.catalog does and `chip` is how it looked then, kept as it was. While its author no
# longer has a sobriety chip they shared (they changed their sobriety date), `chip_hidden`
# keeps it, and reposts of it, off everyone else's feeds (sync_chips).
#
# A note can be written on someone else's profile, someone its author follows or who follows
# them (writable_by?): `recipient` is whose page it's on. It shows on both their timelines.
# Its `visibility` still says who else sees it, counted from its author (so "private" is
# just the two of them), and the person it's on always sees it and can take it off their
# page. These notes aren't shared to groups and can't be reposted.
#
# @ mentions in it (Mentionable) tell the people named, and the role holders in the groups
# it's shared to, if they can see it. Its author can turn its comments off (`comments_off`).
# Notes by someone the viewer blocked (UserBlock), and reposts of them, are left out of what
# they see (not_blocked_by).
class TimelineNote < ApplicationRecord
  moderates_language :body, :hashtags
  include Visibility
  include Reactable
  include Mentionable

  BODY_MAX = 10_000
  IMAGES_MAX = 6

  belongs_to :user
  has_many :shares, class_name: "TimelineNoteShare", dependent: :destroy
  has_many :groups, through: :shares
  has_many_attached :images
  has_many :comments, -> { order(:created_at, :id) }, class_name: "NoteComment", dependent: :destroy
  has_one_attached :link_image
  belongs_to :recipient, class_name: "User", optional: true
  belongs_to :repost_of, class_name: "TimelineNote", optional: true, inverse_of: :reposts
  has_many :reposts, class_name: "TimelineNote", foreign_key: :repost_of_id, inverse_of: :repost_of, dependent: :destroy

  validates :body, length: { maximum: BODY_MAX }
  validate :has_something, unless: :repost?
  validate :images_are_pictures
  validate :can_be_reposted, if: :repost?
  validate :can_write_to_recipient, on: :create, if: :recipient_id
  validates :repost_of_id, uniqueness: { scope: :user_id, message: "is already on your timeline" }, if: :repost?

  before_save { self.hashtags = Hashtags.in(body) if body_changed? || new_record? }
  after_update_commit :drop_reposts, if: -> { saved_change_to_visibility? && visibility != "public" }

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }
  # Not a sobriety chip its author no longer has, nor a repost of one: what others may see
  scope :shown, lambda {
    where(chip_hidden: false).where(<<~SQL.squish)
      timeline_notes.repost_of_id IS NULL OR NOT EXISTS (SELECT 1 FROM timeline_notes o
        WHERE o.id = timeline_notes.repost_of_id AND o.chip_hidden)
    SQL
  }
  # What a feed needs to show notes (and the originals of reposts) without a query each
  scope :for_feed, lambda {
    people = { user: { avatar_attachment: :blob } }
    shown = [:groups, :reposts, { recipient: { avatar_attachment: :blob } }, { images_attachments: :blob, link_image_attachment: :blob, **people, reactions: people,
                                  comments: [people, { reactions: people, timeline_note: :groups }] }]
    includes(*shown, repost_of: shown)
  }

  # Leaves out the notes by people `viewer` blocked, and reposts of their notes
  scope :not_blocked_by, lambda { |viewer|
    next all unless viewer

    blocked = UserBlock.where(blocker_id: viewer.id).select(:blocked_id)
    where.not(user_id: blocked).where(<<~SQL.squish, viewer: viewer.id)
      timeline_notes.repost_of_id IS NULL OR NOT EXISTS (SELECT 1 FROM timeline_notes o
        JOIN user_blocks b ON b.blocked_id = o.user_id AND b.blocker_id = :viewer
        WHERE o.id = timeline_notes.repost_of_id)
    SQL
  }

  scope :tagged, ->(tag) { where("timeline_notes.hashtags @> ARRAY[?]::varchar[]", tag) }

  # Every note `viewer` may see, as visible_to? says for one: their own, what people share
  # on their profiles with them (when profiles are open to them), and notes shared to a
  # group they're both in. Reposts are left out: they show a note that's already here.
  def self.seen_by(viewer)
    return none unless viewer

    in_group = <<~SQL.squish
      EXISTS (SELECT 1 FROM timeline_note_shares s
        JOIN group_memberships vm ON vm.group_id = s.group_id AND vm.user_id = :viewer AND vm.status = 'active'
        JOIN group_memberships am ON am.group_id = s.group_id AND am.user_id = timeline_notes.user_id AND am.status = 'active'
        WHERE s.timeline_note_id = timeline_notes.id)
    SQL
    seen = where(user_id: viewer.id).or(where(recipient_id: viewer.id)).or(where(in_group, viewer: viewer.id))
    if User.profiles_open_to?(viewer)
      followed = Follow.where(follower_id: viewer.id).select(:followed_id)
      seen = seen.or(where(visibility: "public")).or(where(visibility: "followers", user_id: followed))
    end
    seen.where(repost_of_id: nil).merge(where(user_id: viewer.id).or(shown)).not_blocked_by(viewer)
  end

  # What `person`'s profile timeline shows `viewer`: the notes they wrote and the ones written
  # on their page, the ones the viewer may see (all of them, on your own profile)
  def self.on_profile_of(person, viewer)
    theirs = where(user_id: person.id).or(where(recipient_id: person.id))
    return theirs.not_blocked_by(viewer) if viewer&.id == person.id
    return none unless viewer && User.profiles_open_to?(viewer)

    followed = Follow.where(follower_id: viewer.id).select(:followed_id)
    seen = where(user_id: viewer.id).or(where(recipient_id: viewer.id)).or(where(visibility: "public"))
                                    .or(where(visibility: "followers", user_id: followed))
    theirs.and(seen).not_blocked_by(viewer)
  end

  # Whether `author` may write a note on `person`'s page: someone they follow or who follows them
  def self.writable_by?(author, person)
    return false unless author && person && author.id != person.id
    return false if UserBlock.where(blocker: person, blocked: author).or(UserBlock.where(blocker: author, blocked: person)).exists?

    Follow.where(follower_id: author.id, followed_id: person.id).or(Follow.where(follower_id: person.id, followed_id: author.id)).exists?
  end

  # The chip they're sharing, as their Chips page shows it (Chips.catalog), with the design it
  # has now so it stays that way; nil when it isn't one of theirs. A given chip's note to them
  # stays private.
  def self.chip_for(user, chip_id, today = Date.current)
    chip = Chips.catalog(user, today)[:chips].find { |c| c[:id] == chip_id.to_s }
    chip && chip.except(:note, :top, :others).merge(design: chip[:design] || ChipDesign::DEFAULT).deep_stringify_keys
  end

  # Hides their shared sobriety chips they no longer have, and shows again the ones they do
  def self.sync_chips(user)
    notes = user.timeline_notes.where("chip_id LIKE 'round:%'")
    return if notes.none?

    held = user.sobriety_date ? Chips.round_milestones(user.sobriety_date, Date.current)[:earned].map { |m| Chips.round_slot(m[:key], m[:years]) } : []
    notes.where(chip_id: held).update_all(chip_hidden: false)
    notes.where.not(chip_id: held).update_all(chip_hidden: true)
  end

  # The tags on notes `viewer` can see that start with `prefix`, most used first, as
  # [{ name:, count: }], counting only those notes
  def self.hashtag_counts(viewer, prefix: "", limit: 8)
    tags = seen_by(viewer).where.not(hashtags: []).select("unnest(timeline_notes.hashtags) AS tag")
    unscoped.from(tags, :tags).where("tags.tag LIKE ?", "#{sanitize_sql_like(prefix.to_s.downcase)}%")
            .group("tags.tag").order(Arel.sql("COUNT(*) DESC, tags.tag")).limit(limit).count
            .map { |name, count| { name: name, count: count } }
  end

  def repost? = repost_of_id.present?

  # Whether `viewer` may see it (and so react to it or repost it): its author always; on
  # their profile as `visibility` says; and in any group it's shared to that both are in.
  # A repost also needs its original to still be shared with Members.
  def visible_to?(viewer)
    return false unless viewer
    return true if recipient_id && viewer.id == recipient_id
    return false if viewer.id != user_id && (chip_hidden || repost_of&.chip_hidden)
    return repost_of&.visibility == "public" && seen_on_profile_by?(viewer) if repost?

    seen_on_profile_by?(viewer) || groups.any? { |g| g.member?(viewer) && g.member?(user) }
  end

  # Others may repost it when it's shared with Members, unless it's a repost itself
  def repostable_by?(viewer) = !!viewer && viewer.id != user_id && !repost? && !recipient_id && visibility == "public"

  # Why someone else can't repost it (their Repost button says so), or nil when they can
  def repost_blocked_reason(viewer)
    return if !viewer || viewer.id == user_id || repost? || repostable_by?(viewer)
    return "Notes written on someone's page can't be reposted." if recipient_id

    shared = visibility == "followers" ? "with their followers" : "with their group"
    "#{user.display_name.split.first} shared this only #{shared}, so it can't be reposted. Only notes shared with Members can be."
  end

  # Shares it to these groups, only the ones its author is in, and stops sharing it to the rest
  def share_to!(groups)
    return if recipient_id

    allowed = groups.select { |g| g.member?(user) }
    shares.where.not(group_id: allowed.map(&:id)).destroy_all
    allowed.each { |g| shares.find_or_create_by!(group: g) }
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  # What's wrong with these pictures (uploaded files or blobs), with `already` on the note, if anything
  def self.upload_problem(files, already: 0)
    return "A note can have up to #{IMAGES_MAX} pictures." if files.size + already > IMAGES_MAX
    return "Pictures need to be JPEG, PNG, WebP or GIF." unless files.all? { |f| Event::IMAGE_TYPES.include?(f.content_type) }
    return "Pictures need to be under 10 MB each." if files.any? { |f| (f.respond_to?(:byte_size) ? f.byte_size : f.size) > 10.megabytes }
  end

  def edited? = updated_at - created_at > 1.minute

  # Where it shows: the page it was written on, or its author's
  def page_path = (recipient || user).profile_path

  # Its author, or the person whose page it's on, may delete it
  def removable_by?(viewer) = !!viewer && (viewer.id == user_id || viewer.id == recipient_id)

  # Tells who it newly @ mentions, if they can see it; role handles come from the groups it's
  # shared to, and @everyone means nothing here. The person it's written on was already told.
  def mention!(author)
    told_before = Array(mentioned_user_ids)
    self.mentioned_user_ids = told_before | [recipient_id] if recipient_id
    people = take_mentions(body, author: author, groups: groups.to_a, everyone: false, can_see: ->(u) { visible_to?(u) })
    save! if changed?
    tell_mentioned(people, kind: "mention.note", body: body.to_s.truncate(200), url: page_path, from: author,
                           title: ->(handle) { "#{author.display_name} mentioned #{handle ? "@#{handle}" : 'you'} in a note" })
  end

  def image_urls
    images.map { |i| { id: i.id, url: Rails.application.routes.url_helpers.rails_storage_proxy_path(i, only_path: true) } }
  end

  # With `group`, as that group's timeline shows it (can_remove: its author, or the
  # group's admins); without, as a profile shows it (its author also sees where it's shared)
  # and the person it's on can take it off). `recipient` is whose page it was written on.
  # A repost shows its original as `note`, with who reposted it as `author`.
  def as_api_json(viewer:, group: nil)
    return repost_json(viewer) if repost?

    mine = viewer&.id == user_id
    json = { kind: "note", id: id, body: body, images: image_urls, created_at: created_at.iso8601, edited: edited?,
             author: user.as_person_json, mine: mine, mentions: mentions, mentions_me: mentions?(viewer),
             comments_off: comments_off, **social_json(viewer) }
    json[:chip] = chip if chip_id
    json[:chip_hidden] = true if mine && chip_hidden
    json[:recipient] = recipient.as_person_json if recipient
    if group
      json[:can_remove] = mine || group.manageable_by?(viewer)
    elsif mine
      json[:visibility] = visibility
      json[:groups] = groups.map { |g| { slug: g.slug, title: g.title } }
    elsif recipient_id && viewer&.id == recipient_id
      json[:can_remove] = true
    end
    json
  end

  # The note's first link as a card: its page's title, description, site and picture
  def link_json
    return unless link_preview.present?

    image = (Rails.application.routes.url_helpers.rails_storage_proxy_path(link_image, only_path: true) if link_image.attached?)
    link_preview.slice("url", "title", "description", "site_name").merge("image_url" => image)
  end

  # Takes the preview for `url` (LinkPreview, cached from when the note was written, with
  # its picture copied here so readers never load it from the other site), or none when
  # `url` is blank. The same link keeps the one it has.
  def link_url=(url)
    url = url.to_s.strip
    return if url.present? && url == link_preview&.dig("url")

    link_image.purge_later if link_image.attached?
    preview = (LinkPreview.fetch(url) if url.present?)
    self.link_preview = preview&.slice(:url, :title, :description, :site_name)&.stringify_keys
    image = preview && preview[:image_url] && LinkPreview.image(preview[:image_url])
    link_image.attach(image) if image
  end

  private

  COMMENTS_MAX = 100

  # Reactions, comments and reposts
  def social_json(viewer)
    { **reactions_json(viewer), link: link_json,
      comments: shown_comments(viewer).last(COMMENTS_MAX).map { |c| c.as_api_json(viewer: viewer) },
      comment_count: shown_comments(viewer).size,
      can_comment: !viewer.nil? && !comments_off,
      repost_count: reposts.size, reposted: reposts.any? { |r| r.user_id == viewer&.id }, can_repost: repostable_by?(viewer),
      repost_blocked: repost_blocked_reason(viewer) }
  end

  # Its comments, but not the ones by people the viewer blocked
  def shown_comments(viewer)
    blocked = viewer ? viewer.blocked_ids : []
    blocked.empty? ? comments : comments.reject { |c| blocked.include?(c.user_id) }
  end

  def repost_json(viewer)
    json = { kind: "repost", id: id, created_at: created_at.iso8601, author: user.as_person_json,
             mine: viewer&.id == user_id, note: repost_of.as_api_json(viewer: viewer) }
    json[:visibility] = visibility if json[:mine]
    json
  end

  def seen_on_profile_by?(viewer)
    return true if viewer.id == user_id
    return false unless User.profiles_open_to?(viewer)

    visibility == "public" || (visibility == "followers" && Follow.exists?(follower_id: viewer.id, followed_id: user_id))
  end

  def can_be_reposted
    errors.add(:base, "You can only repost a note shared with Members.") unless repost_of&.repostable_by?(user)
  end

  def drop_reposts = reposts.destroy_all

  def can_write_to_recipient
    return errors.add(:base, "You can't share or repost a note on someone's page.") if repost? || chip_id
    return if self.class.writable_by?(user, recipient)

    errors.add(:base, "You can write on the pages of people you follow or who follow you.")
  end

  def has_something
    errors.add(:base, "Write something or add a picture") if body.to_s.strip.empty? && !images.attached? && !chip_id
  end

  def images_are_pictures
    problem = self.class.upload_problem(images.map(&:blob))
    errors.add(:base, problem) if problem
  end
end
