class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :lockable, :timeoutable, :trackable and :omniauthable
  # :confirmable: new accounts confirm their email address before they can sign in
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :validatable, :confirmable

  has_one :user_active_group, -> { order(updated_at: :desc) }, dependent: :destroy
  has_many :group_memberships, dependent: :destroy
  # The member's own recovery tools, only ever seen by them (Api::RecoveryController)
  has_many :step_inventories, dependent: :delete_all
  has_many :gratitude_lists, dependent: :delete_all
  # Chips their groups' hosts gave them (and ones they gave), and the meetings they clicked
  # Join on, for Meeting Maker chips (Chips)
  has_many :chip_awards, dependent: :delete_all
  has_many :chip_awards_given, class_name: "ChipAward", foreign_key: :given_by_id, dependent: :nullify, inverse_of: :given_by
  has_many :meeting_joins, dependent: :delete_all
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
  RESERVED_USERNAMES = %w[me edit tags].freeze

  before_validation :assign_username, on: :create
  before_validation { self.page_blocks = EventBlocks.normalize(page_blocks, types: EventBlocks::PROFILE_TYPES) unless page_blocks.nil? }
  validates :username, presence: true, uniqueness: { case_sensitive: false }, exclusion: { in: RESERVED_USERNAMES },
                       format: { with: USERNAME, message: "can use lowercase letters, numbers and dashes (2 to 30)" }
  validates :page_layout, inclusion: { in: Event::LAYOUTS }
  validates :default_highlight_visibility, :default_note_visibility, inclusion: { in: Visibility::LEVELS }
  # How long before a meeting they host a reminder goes out (HostReminders), when they turn it on
  HOST_REMINDER_HOURS = [2, 6, 12, 24, 48].freeze
  validates :host_reminder_hours, inclusion: { in: HOST_REMINDER_HOURS }
  # The daily gratitude and 10th step reminders (RecoveryReminders): a time of day, "HH:MM",
  # in their own time zone (an IANA name their browser sends when they turn one on)
  validates :gratitude_reminder_at, :step_reminder_at, format: { with: /\A([01]\d|2[0-3]):[0-5]\d\z/, message: "should be a time like 18:00" }
  validate { errors.add(:time_zone, "isn't one we know") if time_zone.present? && ActiveSupport::TimeZone[time_zone].nil? }
  # Turning one on, or moving it, after today's time has passed starts it tomorrow rather than
  # sending it right away
  before_save do
    %w[gratitude step].each do |which|
      next unless public_send("#{which}_reminder") && (will_save_change_to_attribute?("#{which}_reminder") || will_save_change_to_attribute?("#{which}_reminder_at"))

      now = Time.current.in_time_zone(zone)
      public_send("#{which}_reminded_on=", now.to_date) if now.hour * 60 + now.min >= RecoveryReminders.minutes(public_send("#{which}_reminder_at"))
    end
  end

  AVATAR_TYPES = %w[image/jpeg image/png image/webp].freeze
  validates :bio, length: { maximum: 280 }
  validate :avatar_is_an_image
  validate :sobriety_date_is_past

  has_many :user_highlights, dependent: :destroy
  has_many :text_reports, dependent: :destroy
  has_many :notifications, dependent: :destroy
  has_many :today_dismissals, dependent: :delete_all
  has_many :push_subscriptions, dependent: :delete_all
  has_many :text_report_comments, dependent: :destroy
  has_many :resolved_text_reports, class_name: "TextReport", foreign_key: :resolved_by_id, dependent: :nullify
  has_many :schedule_polls, dependent: :destroy
  has_many :schedule_poll_members, dependent: :destroy
  has_many :schedule_poll_ballots, dependent: :nullify
  has_many :event_collaborators, dependent: :destroy
  has_many :timeline_notes, dependent: :destroy
  has_many :note_reactions, dependent: :delete_all
  has_many :note_comments, dependent: :destroy
  has_many :chat_messages, dependent: :delete_all
  has_many :chat_reads, dependent: :delete_all
  has_many :group_blocks, dependent: :delete_all
  has_many :event_rsvps, dependent: :destroy
  has_many :intergroup_follows, dependent: :destroy
  has_many :host_sub_requests_made, class_name: "HostSubRequest", foreign_key: :requested_by_id, dependent: :nullify, inverse_of: :requested_by
  has_many :host_sub_requests_filled, class_name: "HostSubRequest", foreign_key: :filled_by_id, dependent: :nullify, inverse_of: :filled_by
  has_many :meeting_host_reminders, dependent: :delete_all
  has_many :page_templates_updated, class_name: "GroupPageTemplate", foreign_key: :updated_by_id, dependent: :nullify, inverse_of: :updated_by
  # Readings are shared with everyone, so an account that added some isn't deleted on its own
  # (Api::ProfilesController#destroy says to get in touch instead)
  has_many :readings, dependent: :restrict_with_error
  # Analytics stay as anonymous counts when an account is deleted
  has_many :visits, class_name: "Ahoy::Visit", dependent: :nullify
  has_many :ahoy_events, class_name: "Ahoy::Event", dependent: :nullify

  # Set default values for new users
  after_initialize :set_defaults, unless: :persisted?
  before_save :sync_confirmed
  # Sobriety chips they shared show only while they have them
  after_update_commit -> { TimelineNote.sync_chips(self) }, if: :saved_change_to_sobriety_date?

  def set_defaults
    self.admin ||= false
    self.confirmed ||= false
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

  # Devise, once the email address is confirmed: chips sent to it are theirs
  def after_confirmation
    super if defined?(super)
    ChipAward.claim_for(self)
  end

  def following?(other) = !!other && follows_given.exists?(followed_id: other.id)
  def custom_page? = !page_blocks.nil?

  # Their favorite chips show on their profile when it has a Chips block (EventBlocks); the
  # switch on the Chips page adds one under About (making the default page theirs) or takes it off
  def show_chips_on_profile = !!page_blocks&.any? { |b| b["type"] == "chips" }

  def show_chips_on_profile=(on)
    on = ActiveModel::Type::Boolean.new.cast(on)
    return if on == show_chips_on_profile

    blocks = (page_blocks || ProfilePage.default_blocks).map(&:dup)
    if on
      about = blocks.index { |b| b["type"] == "about" }
      blocks.insert(about ? about + 1 : blocks.size, { "type" => "chips", "region" => about ? blocks[about]["region"] : "side" })
    else
      blocks.reject! { |b| b["type"] == "chips" }
    end
    self.page_blocks = blocks
  end

  # Their hosting: the groups they can host for, their meetings and coming dates
  def host_commitments = @host_commitments ||= HostCommitments.new(self)
  def host? = host_commitments.host?

  # Whether a notification of this kind goes to their devices too (account settings >
  # Notifications on this device). Kinds outside Notification::PUSH_CATEGORIES always do.
  # Their own time zone, or the site's (Arizona) until their browser has told us
  def zone = (time_zone.presence && ActiveSupport::TimeZone[time_zone]) || Time.zone

  def wants_push?(kind)
    category = Notification.push_category(kind)
    category.nil? || !push_off.include?(category)
  end

  # The push categories offered to them, each with whether it's on
  def push_categories
    Notification::PUSH_CATEGORIES.reject { |_, c| c[:admin_only] && !suite_admin? }
                                 .map { |key, c| { key: key, label: c[:label], description: c[:description], on: !push_off.include?(key) } }
  end

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

  private

  # `confirmed` (the old admin-approval flag, still what queries use) and Devise's
  # `confirmed_at` say the same thing: confirming the email sets the flag, and an account
  # made or approved with confirmed: true (an admin, a test) counts as confirmed.
  def sync_confirmed
    self.confirmed = true if confirmed_at.present?
    self.confirmed_at ||= Time.current if self[:confirmed]
  end

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
