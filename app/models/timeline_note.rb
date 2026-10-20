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
class TimelineNote < ApplicationRecord
  include Visibility
  include Reactable

  BODY_MAX = 10_000
  IMAGES_MAX = 6

  belongs_to :user
  has_many :shares, class_name: "TimelineNoteShare", dependent: :destroy
  has_many :groups, through: :shares
  has_many_attached :images
  has_many :comments, -> { order(:created_at, :id) }, class_name: "NoteComment", dependent: :destroy
  has_one_attached :link_image
  belongs_to :repost_of, class_name: "TimelineNote", optional: true, inverse_of: :reposts
  has_many :reposts, class_name: "TimelineNote", foreign_key: :repost_of_id, inverse_of: :repost_of, dependent: :destroy

  validates :body, length: { maximum: BODY_MAX }
  validate :has_something, unless: :repost?
  validate :images_are_pictures
  validate :can_be_reposted, if: :repost?
  validates :repost_of_id, uniqueness: { scope: :user_id, message: "is already on your timeline" }, if: :repost?

  after_update_commit :drop_reposts, if: -> { saved_change_to_visibility? && visibility != "public" }

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }
  # What a feed needs to show notes (and the originals of reposts) without a query each
  scope :for_feed, lambda {
    people = { user: { avatar_attachment: :blob } }
    shown = [:groups, :reposts, { images_attachments: :blob, link_image_attachment: :blob, **people, reactions: people,
                                  comments: [people, { reactions: people, timeline_note: :groups }] }]
    includes(*shown, repost_of: shown)
  }

  def repost? = repost_of_id.present?

  # Whether `viewer` may see it (and so react to it or repost it): its author always; on
  # their profile as `visibility` says; and in any group it's shared to that both are in.
  # A repost also needs its original to still be shared with Members.
  def visible_to?(viewer)
    return false unless viewer
    return repost_of&.visibility == "public" && seen_on_profile_by?(viewer) if repost?

    seen_on_profile_by?(viewer) || groups.any? { |g| g.member?(viewer) && g.member?(user) }
  end

  # Others may repost it when it's shared with Members, unless it's a repost itself
  def repostable_by?(viewer) = !!viewer && viewer.id != user_id && !repost? && visibility == "public"

  # Shares it to these groups, only the ones its author is in, and stops sharing it to the rest
  def share_to!(groups)
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

  def image_urls
    images.map { |i| { id: i.id, url: Rails.application.routes.url_helpers.rails_storage_proxy_path(i, only_path: true) } }
  end

  # With `group`, as that group's timeline shows it (can_remove: its author, or the
  # group's admins); without, as a profile shows it (its author also sees where it's shared)
  # A repost shows its original as `note`, with who reposted it as `author`.
  def as_api_json(viewer:, group: nil)
    return repost_json(viewer) if repost?

    mine = viewer&.id == user_id
    json = { kind: "note", id: id, body: body, images: image_urls, created_at: created_at.iso8601, edited: edited?,
             author: user.as_person_json, mine: mine, **social_json(viewer) }
    if group
      json[:can_remove] = mine || group.manageable_by?(viewer)
    elsif mine
      json[:visibility] = visibility
      json[:groups] = groups.map { |g| { slug: g.slug, title: g.title } }
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
      comments: comments.last(COMMENTS_MAX).map { |c| c.as_api_json(viewer: viewer) }, comment_count: comments.size,
      can_comment: !viewer.nil?,
      repost_count: reposts.size, reposted: reposts.any? { |r| r.user_id == viewer&.id }, can_repost: repostable_by?(viewer) }
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

  def has_something
    errors.add(:base, "Write something or add a picture") if body.to_s.strip.empty? && !images.attached?
  end

  def images_are_pictures
    problem = self.class.upload_problem(images.map(&:blob))
    errors.add(:base, problem) if problem
  end
end
