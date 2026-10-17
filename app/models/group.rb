# A home group: its meetings (often linked to OIAA's directory), members with roles, the
# literature it has approved, the readings members tag to it, and its court verifications.
#
# Groups are admin-only while they're tried out (see .feature_open_to?): site admins see
# everything, and anyone already in a group sees that group.
class Group < ApplicationRecord
  TIME_ZONES = SchedulePoll::TIME_ZONES
  STATUSES = %w[active pending].freeze
  # Paths in the Groups app (app/javascript/entrypoints/groups.jsx) a group can't be named
  RESERVED_SLUGS = %w[new find default-page timeline meetings].freeze

  belongs_to :created_by, class_name: "User", optional: true
  has_many :memberships, class_name: "GroupMembership", dependent: :destroy
  has_many :active_memberships, -> { active }, class_name: "GroupMembership"
  has_many :members, through: :active_memberships, source: :user
  has_many :meetings, dependent: :destroy
  has_many :group_books, dependent: :destroy
  has_many :books, through: :group_books
  has_many :readings, dependent: :nullify
  has_many :court_verifications, dependent: :nullify
  has_many :events, dependent: :destroy
  has_many :timeline_note_shares, dependent: :destroy
  has_many :timeline_notes, through: :timeline_note_shares

  # The group's page (Api::GroupPagesController): page_blocks stays nil until the group
  # saves its own, and until then it shows the default page (GroupPageTemplate)
  has_one_attached :cover
  # Pictures placed in the page's blocks
  has_many_attached :page_images

  before_validation :assign_slug
  before_validation { self.join_token ||= self.class.new_token }
  before_validation { self.page_blocks = EventBlocks.normalize(page_blocks, types: EventBlocks::GROUP_TYPES) unless page_blocks.nil? }
  # Text left at the default is stored as blank, so it follows later changes to the default
  before_validation do
    self.court_email_subject = nil if court_email_subject.to_s.squish == CourtLetter::DEFAULT_SUBJECT
    self.court_email_body = nil if court_email_body.to_s.strip == CourtLetter.default_body(self).strip
  end

  validates :title, presence: true, length: { maximum: 120 }
  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9-]+\z/ }, exclusion: { in: RESERVED_SLUGS }
  validates :page_layout, inclusion: { in: Event::LAYOUTS }
  validates :time_zone, inclusion: { in: TIME_ZONES }
  validates :status, inclusion: { in: STATUSES }
  validates :description, length: { maximum: 1000 }
  validates :court_email_subject, length: { maximum: 200 }
  validates :court_email_body, length: { maximum: 5000 }
  validates :court_email_reply_to, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validate :court_email_placeholders_known

  scope :active, -> { where(status: "active") }

  def self.new_token = SecureRandom.alphanumeric(12).downcase

  # Who sees Groups at all. GROUPS_FOR_EVERYONE=1 opens it up to every signed-in account.
  def self.feature_open_to?(user)
    return false unless user
    ActiveModel::Type::Boolean.new.cast(ENV["GROUPS_FOR_EVERYONE"]) || user.suite_admin?
  end

  def self.visible_to(user)
    return none unless user
    return all if user.suite_admin?
    scope = where(id: GroupMembership.active.where(user: user).select(:group_id))
    feature_open_to?(user) ? scope.or(active) : scope
  end

  def to_param = slug
  def zone = ActiveSupport::TimeZone[time_zone]
  def pending? = status == "pending"

  def membership_for(user) = user && memberships.find_by(user: user)
  def member?(user) = !!membership_for(user)&.active?
  def admin?(user) = !!membership_for(user)&.then { |m| m.active? && m.admin? }
  def manageable_by?(user) = !!user && (user.suite_admin? || admin?(user))
  # Anyone, signed in or not, can look at an active group's page and meetings (finding a
  # meeting needs no account); a group that's waiting for approval only shows to whoever
  # can see it. Members' things stay with members (GroupPage, Api::GroupsController#group_json).
  def self.viewable_by(user) = where(status: "active").or(where(id: visible_to(user).select(:id)))
  def viewable_by?(user) = active? || visible_to?(user)
  def visible_to?(user) = !!user && (user.suite_admin? || member?(user) || (active? && self.class.feature_open_to?(user)))
  def active? = status == "active"
  def admins = members.merge(GroupMembership.admins)
  def custom_page? = !page_blocks.nil?

  # Notes members shared to the group, newest first; a note stops showing when its author
  # leaves
  def shared_notes = timeline_notes.where(user_id: members.select(:id)).includes(user: { avatar_attachment: :blob }).newest_first

  # Readings members tagged to this group; drafts and scheduled ones stay with their author
  def shared_readings = readings.published.includes(:user).order(published_at: :desc)

  # The court verification email as its editor shows it: what the group wrote, or the default
  def court_email_json
    {
      subject: court_email_subject.presence || CourtLetter::DEFAULT_SUBJECT,
      body: court_email_body.presence || CourtLetter.default_body(self),
      reply_to: court_email_reply_to,
      default_subject: CourtLetter::DEFAULT_SUBJECT,
      default_body: CourtLetter.default_body(self),
      fields: CourtLetter::FIELDS,
    }
  end

  # Asks to join for `user` (a group admin approves); nothing changes if they're in already or waiting
  def request_to_join!(user)
    membership = memberships.find_or_initialize_by(user: user)
    return membership unless membership.new_record?

    membership.update!(role: "member", status: "requested")
    notify_admins(kind: "group.join_request", title: "#{user.display_name} asked to join #{title}")
    membership
  end

  def notify_admins(kind:, title:, body: nil, url: "/groups/#{slug}")
    recipients = admins.to_a.presence || User.suite_admins
    Notification.deliver(recipients, kind: kind, title: title, body: body, url: url)
  end

  private

  def court_email_placeholders_known
    %i[court_email_subject court_email_body].each do |attr|
      unknown = CourtLetter.unknown_placeholders(self[attr])
      errors.add(attr, "uses #{unknown.map { |k| "{{#{k}}}" }.to_sentence}, which the form doesn't fill in") if unknown.any?
    end
  end

  def assign_slug
    return if slug.present? || title.blank?

    base = title.parameterize.first(60).presence || "group"
    candidate = base
    n = 1
    candidate = "#{base}-#{n += 1}" while RESERVED_SLUGS.include?(candidate) || self.class.where.not(id: id).exists?(slug: candidate)
    self.slug = candidate
  end
end
