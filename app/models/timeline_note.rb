# A note on its author's timeline, on their profile (/people/:username). Notes are
# Markdown, like the notes on highlights, and can hold pictures. `visibility` says who
# sees it on the profile (Visibility); sharing it to groups they're in also shows it to
# that group's members in the group page's Timeline block. A group's admins can take a
# note off their group's timeline.
class TimelineNote < ApplicationRecord
  include Visibility

  BODY_MAX = 10_000
  IMAGES_MAX = 6

  belongs_to :user
  has_many :shares, class_name: "TimelineNoteShare", dependent: :destroy
  has_many :groups, through: :shares
  has_many_attached :images

  validates :body, length: { maximum: BODY_MAX }
  validate :has_something
  validate :images_are_pictures

  scope :newest_first, -> { order(created_at: :desc, id: :desc) }

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
  def as_api_json(viewer:, group: nil)
    mine = viewer&.id == user_id
    json = { kind: "note", id: id, body: body, images: image_urls, created_at: created_at.iso8601, edited: edited?,
             author: user.as_person_json, mine: mine }
    if group
      json[:can_remove] = mine || group.manageable_by?(viewer)
    elsif mine
      json[:visibility] = visibility
      json[:groups] = groups.map { |g| { slug: g.slug, title: g.title } }
    end
    json
  end

  private

  def has_something
    errors.add(:base, "Write something or add a picture") if body.to_s.strip.empty? && !images.attached?
  end

  def images_are_pictures
    problem = self.class.upload_problem(images.map(&:blob))
    errors.add(:base, problem) if problem
  end
end
