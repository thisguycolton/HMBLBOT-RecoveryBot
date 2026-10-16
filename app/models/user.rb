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

  # Shown in groups: first name, picture and blurb. Email only to group admins.
  def as_member_json(email: false)
    { id: id, name: display_name, bio: bio, avatar_url: avatar_url, email: (self.email if email),
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
end
