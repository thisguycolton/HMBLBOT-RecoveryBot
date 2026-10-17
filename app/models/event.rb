# A group's event, laid out in the HMBLBOT Editor (app/javascript/components/events/editor).
# Only groups have events for now. Group admins create them and can edit any of their
# group's events; they can also add members of the group as collaborators, who can edit
# that one event. A published event is public to anyone with its link (so people without
# an account can RSVP with just an email); drafts are seen only by the people editing.
class Event < ApplicationRecord
  LAYOUTS = %w[main_side centered side_main].freeze
  STATUSES = %w[draft published].freeze
  IMAGE_TYPES = %w[image/jpeg image/png image/webp image/gif].freeze
  # As long as a member's profile blurb (User#bio)
  SHORT_DESCRIPTION_MAX = 280

  belongs_to :group
  belongs_to :created_by, class_name: "User", optional: true
  has_many :collaborators, class_name: "EventCollaborator", dependent: :destroy
  has_many :collaborator_users, through: :collaborators, source: :user
  has_many :rsvps, class_name: "EventRsvp", dependent: :destroy
  has_many :updates, class_name: "EventUpdate", dependent: :destroy
  has_many :schedule_polls, dependent: :nullify
  # The business meeting this event announces, if it does
  has_one :business_meeting, dependent: :nullify

  has_one_attached :cover
  has_one_attached :flyer
  # Pictures placed in blocks (agenda activities, photos, galleries)
  has_many_attached :images

  before_validation { self.token ||= SecureRandom.alphanumeric(10).downcase }
  before_validation { self.blocks = EventBlocks.normalize(blocks) }
  before_validation { self.published_at ||= Time.current if published? }

  validates :title, presence: true, length: { maximum: 120 }
  validates :token, presence: true, uniqueness: true
  validates :short_description, length: { maximum: SHORT_DESCRIPTION_MAX }
  validates :location, length: { maximum: 300 }
  validates :layout, inclusion: { in: LAYOUTS }
  validates :status, inclusion: { in: STATUSES }
  validates :time_zone, inclusion: { in: Group::TIME_ZONES }
  validate :ends_after_start
  validate :pictures_are_images

  scope :published, -> { where(status: "published") }
  scope :upcoming_first, -> { order(Arel.sql("starts_at IS NULL, starts_at ASC"), created_at: :desc) }

  def to_param = token
  def path = "/events/#{token}"
  def zone = ActiveSupport::TimeZone[time_zone]
  def published? = status == "published"

  # Group admins (and site admins) run every event in their group
  def self.creatable_by?(group, user) = group.manageable_by?(user)

  def manager?(user) = group.manageable_by?(user)
  def collaborator?(user) = !!user && collaborators.exists?(user_id: user.id)
  def editable_by?(user) = manager?(user) || collaborator?(user)
  def visible_to?(user) = published? || editable_by?(user)

  # Group admins only: everyone who edits it is told about updates by the editor itself
  def editors = (group.admins.to_a + collaborator_users.to_a).uniq

  def rsvp_for(user) = user && rsvps.find_by(user: user)

  # Everyone who hears about updates: going, maybe, or following because they voted in
  # one of its polls
  def followers = rsvps.subscribed

  # Voting in one of the event's polls with an account follows the event
  def follow!(user)
    return unless user && published?

    rsvps.create_with(status: "following").find_or_create_by!(user: user)
  rescue ActiveRecord::RecordNotUnique
    rsvps.find_by(user: user)
  end

  # Sends an update for each announcing block (notes marked as updates, guidelines set to
  # notify) whose text changed since `before`. Only once the event is published.
  def announce_changes(before, by:)
    return [] unless published?

    old = EventBlocks.announced(before)
    EventBlocks.announced(blocks).filter_map do |block_id, (kind, markdown)|
      next if markdown.to_s.strip.empty?
      next if old.dig(block_id, 1).to_s.strip == markdown.to_s.strip

      updates.create!(block_id: block_id, kind: kind, created_by: by, **EventUpdate.split(markdown, kind: kind))
    end
  end

  def starts_local = starts_at&.in_time_zone(zone)
  def ends_local = ends_at&.in_time_zone(zone)

  # "2026-10-16T19:00" in the event's time zone, or nil
  def self.local_value(time, zone) = time&.in_time_zone(zone)&.strftime("%Y-%m-%dT%H:%M")

  def when_label
    return unless starts_local

    label = starts_local.strftime("%a, %b %-d, %Y · %-l:%M %p")
    if ends_local
      label += ends_local.to_date == starts_local.to_date ? " – #{ends_local.strftime('%-l:%M %p')}" : " – #{ends_local.strftime('%a, %b %-d · %-l:%M %p')}"
    end
    "#{label} #{starts_local.strftime('%Z')}"
  end

  def image_path(attachment)
    return unless attachment.attached?

    Rails.application.routes.url_helpers.rails_storage_proxy_path(attachment, only_path: true)
  end

  def card_json
    {
      token: token, title: title, short_description: short_description, status: status,
      starts_at: starts_at&.iso8601, when_label: when_label, location: location,
      cover_url: image_path(cover), going_count: rsvps.going.count,
    }
  end

  private

  def ends_after_start
    errors.add(:ends_at, "must be after it starts") if starts_at && ends_at && ends_at <= starts_at
    errors.add(:starts_at, "is needed when there's an end time") if ends_at && !starts_at
  end

  def pictures_are_images
    { cover: cover, flyer: flyer }.each do |name, file|
      next unless file.attached?

      errors.add(name, "must be a JPEG, PNG, WebP or GIF image") unless IMAGE_TYPES.include?(file.blob.content_type)
      errors.add(name, "must be under 10 MB") if file.blob.byte_size > 10.megabytes
    end
  end
end
