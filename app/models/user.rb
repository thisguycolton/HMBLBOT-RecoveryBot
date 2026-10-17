class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable, :trackable and :omniauthable
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable

  has_one :user_active_group, -> { order(updated_at: :desc) }, dependent: :destroy
  has_many :group_memberships, dependent: :destroy
  has_many :created_groups, class_name: "Group", foreign_key: :created_by_id, dependent: :nullify, inverse_of: :created_by
  has_many :groups, -> { merge(GroupMembership.active) }, through: :group_memberships
  has_one_attached :avatar
  # Their profile page (/people/:username, Api::PeopleController), laid out like a group's
  has_one_attached :profile_cover
  has_many_attached :page_images

  has_many :follows_given, class_name: "Follow", foreign_key: :follower_id, dependent: :destroy, inverse_of: :follower
  has_many :follows_received, class_name: "Follow", foreign_key: :followed_id, dependent: :destroy, inverse_of: :followed
  has_many :following, through: :follows_given, source: :followed
  has_many :followers, through: :follows_received, source: :follower

  USERNAME = /\A[a-z0-9][a-z0-9-]{1,29}\z/
  RESERVED_USERNAMES = %w[me edit].freeze

  before_validation :assign_username, on: :create
  before_validation { self.page_blocks = EventBlocks.normalize(page_blocks, types: EventBlocks::PROFILE_TYPES) unless page_blocks.nil? }
  validates :username, presence: true, uniqueness: { case_sensitive: false }, exclusion: { in: RESERVED_USERNAMES },
                       format: { with: USERNAME, message: "can use lowercase letters, numbers and dashes (2 to 30)" }
  validates :page_layout, inclusion: { in: Event::LAYOUTS }
  validates :default_highlight_visibility, :default_note_visibility, inclusion: { in: Visibility::LEVELS }

  AVATAR_TYPES = %w[image/jpeg image/png image/webp].freeze
  validates :bio, length: { maximum: 280 }
  validate :avatar_is_an_image
  validate :sobriety_date_is_past

  has_many :user_highlights, dependent: :destroy
  has_many :text_reports, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :text_report_comments, dependent: :destroy
  has_many :resolved_text_reports, class_name: "TextReport", foreign_key: :resolved_by_id, dependent: :nullify
  has_many :schedule_polls, dependent: :destroy
  has_many :schedule_poll_members, dependent: :destroy
  has_many :schedule_poll_ballots, dependent: :nullify
  has_many :event_collaborators, dependent: :destroy
  has_many :timeline_notes, dependent: :destroy
  has_many :event_rsvps, dependent: :destroy

  # Set default values for new users
  after_initialize :set_defaults, unless: :persisted?
  after_create_commit :notify_admins_of_signup, unless: :confirmed?

  def set_defaults
    self.admin ||= false
    self.confirmed ||= false
  end

  # New sign-ups wait for an admin to approve them in the admin suite's Users page
  def notify_admins_of_signup
    Notification.deliver(User.suite_admins, kind: "user.pending", title: "#{name.presence || email} is waiting for approval",
                                            url: "/admin_panel/users")
  end

  # Only allow confirmed users to sign in
  def active_for_authentication?
    super && confirmed?
  end

  # The admin suite (/admin_panel) shows members' attendance records, visits and accounts, so
  # being an admin isn't enough: the email must also be in ADMIN_EMAILS (comma-separated;
  # COURT_VERIFICATION_ADMIN_EMAILS is still read for older setups). Unset means nobody.
  # Everyone who can use the admin suite (see #suite_admin?)
  def self.suite_admins
    where(admin: true).select(&:suite_admin?)
  end

  def suite_admin?
    allowed = (ENV["ADMIN_EMAILS"].presence || ENV["COURT_VERIFICATION_ADMIN_EMAILS"]).to_s
                .split(",").map { |e| e.strip.downcase }
    admin? && allowed.include?(email.to_s.downcase)
  end

  def display_name = name.presence || email.to_s.split("@").first

  # Served through the app (like book covers) so S3 URLs never reach the page
  def avatar_url
    return unless avatar.attached?
    Rails.application.routes.url_helpers.rails_storage_proxy_path(avatar, only_path: true)
  end

  # Profiles and following are open to whoever can use Groups (admin-only while it's tried out)
  def self.profiles_open_to?(user) = !!user && (Group.feature_open_to?(user) || user.group_memberships.exists?)

  def profile_path = "/people/#{username}"
  def following?(other) = !!other && follows_given.exists?(followed_id: other.id)
  def custom_page? = !page_blocks.nil?

  # Enough to show and link to them anywhere
  def as_person_json = { id: id, name: display_name, username: username, avatar_url: avatar_url }

  # Shown in groups: first name, picture and blurb. Email only to group admins.
  def as_member_json(email: false)
    { id: id, name: display_name, username: username, bio: bio, avatar_url: avatar_url, email: (self.email if email),
      sobriety_date: (sobriety_date&.iso8601 if show_sobriety_date) }.compact
  end

  # The "You're not in a group yet" nudge: Groups is open to them, they aren't in (or
  # waiting on) one, and they haven't waved it off in the last 30 days.
  def needs_group?
    Group.feature_open_to?(self) && !group_memberships.exists? &&
      (group_prompt_dismissed_at.nil? || group_prompt_dismissed_at < 30.days.ago)
  end

  # Provide a message if user is not confirmed
  def inactive_message
    confirmed? ? super : :unconfirmed
  end

  private

  def sobriety_date_is_past
    errors.add(:sobriety_date, "can't be in the future") if sobriety_date && sobriety_date > Date.current + 1
  end

  def avatar_is_an_image
    return unless avatar.attached?

    errors.add(:avatar, "must be a JPEG, PNG or WebP image") unless AVATAR_TYPES.include?(avatar.blob.content_type)
    errors.add(:avatar, "must be under 5 MB") if avatar.blob.byte_size > 5.megabytes
  end

  def assign_username
    return if username.present?

    base = (name.presence || email.to_s.split("@").first).to_s.parameterize.first(26).sub(/-+\z/, "").presence || "member"
    base = "member" if RESERVED_USERNAMES.include?(base) || base.length < 2
    candidate = base
    n = 1
    candidate = "#{base}-#{n += 1}" while self.class.where.not(id: id).exists?(username: candidate)
    self.username = candidate
  end
end
