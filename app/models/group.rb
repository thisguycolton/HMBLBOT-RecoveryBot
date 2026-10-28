# A home group: its meetings (often linked to OIAA's directory), members with roles, the
# literature it has approved, the readings members tag to it, and its court verifications.
#
# Groups are admin-only while they're tried out (see .feature_open_to?): site admins see
# everything, and anyone already in a group sees that group. An active group's page is
# open to everyone, signed in or not (.viewable_by), for Find a meeting.
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
  has_many :documents, class_name: "GroupDocument", dependent: :destroy
  has_many :motions, dependent: :destroy
  has_many :business_meetings, dependent: :destroy
  has_many :service_positions, dependent: :destroy
  has_many :treasurer_reports, dependent: :destroy
  has_many :timeline_note_shares, dependent: :destroy
  has_many :timeline_notes, through: :timeline_note_shares

  # The group's page (Api::GroupPagesController): page_blocks stays nil until the group
  # saves its own, and until then it shows the default page (GroupPageTemplate)
  has_one_attached :cover
  # The group's logo, shown in a rounded square (Group settings)
  has_one_attached :logo
  has_many :document_templates, class_name: "GroupDocumentTemplate", dependent: :destroy
  # The Hosting Command Center: the default kit (meeting_id nil) and each meeting's own
  has_many :hosting_kits, dependent: :destroy
  has_many :hosting_layouts, dependent: :destroy
  has_many :decks, dependent: :destroy
  has_many :deck_templates, dependent: :delete_all
  # Chips its hosts gave (ChipAward)
  has_many :chip_awards, dependent: :delete_all
  has_many :chip_templates, dependent: :destroy
  has_many :chip_editions, dependent: :destroy
  LOGO_TYPES = %w[image/png image/jpeg image/webp image/gif].freeze
  validate { errors.add(:logo, "has to be a PNG, JPEG, WebP or GIF image") if logo.attached? && !LOGO_TYPES.include?(logo.blob.content_type) }
  validate { errors.add(:logo, "has to be under 5 MB") if logo.attached? && logo.blob.byte_size > 5.megabytes }
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
  before_validation { self.deck_editors = DECK_EDITOR_ROLES & Array(deck_editors).map(&:to_s) }
  validates :time_zone, inclusion: { in: TIME_ZONES }
  validates :status, inclusion: { in: STATUSES }
  validates :description, length: { maximum: 1000 }
  validates :quorum_count, numericality: { only_integer: true, in: 1..9999 }, allow_nil: true
  validates :quorum_percent, numericality: { only_integer: true, in: 1..100 }, allow_nil: true
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

  # Anyone may see an active group's page and ask to join it, signed in or not: Find a
  # meeting is open to everyone. The rest of Groups stays behind .visible_to.
  def self.viewable_by(user) = user ? active.or(visible_to(user)) : active

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
  # Who schedules the hosts of its meetings: group admins, and members an admin marked in the
  # Members tab (the person doing that needn't keep the records). A coordinator an admin limited
  # to some time slots (GroupMembership#host_slots_only) schedules only those meetings, so given
  # a meeting this asks about that one; without one, about the host schedule as a whole.
  def hosts_editable_by?(user, meeting = nil)
    return true if manageable_by?(user)

    !!membership_for(user)&.then { |m| m.active? && m.can_schedule_hosts && (meeting.nil? || m.coordinates?(meeting)) }
  end

  # A coordinator for every meeting (not limited to time slots): sets up the group's default kit
  def all_hosts_editable_by?(user) = manageable_by?(user) || !!membership_for(user)&.then { |m| m.active? && m.can_schedule_hosts && !m.host_slots_only }

  # The weekly meetings a slot-limited coordinator looks after (nil: all of them)
  def coordinated_meeting_ids(user)
    return if manageable_by?(user)

    m = membership_for(user)
    m.host_meeting_ids if m&.active? && m.slot_coordinator?
  end

  # Who hears about a meeting's hosts: admins and the coordinators of the whole group, and those
  # whose time slots include the meeting (all of them when no meeting is given)
  def host_schedulers(meeting = nil)
    coordinators = active_memberships.where(can_schedule_hosts: true)
    coordinators = coordinators.coordinating(meeting) if meeting
    User.where(id: active_memberships.admins.select(:user_id)).or(User.where(id: coordinators.select(:user_id)))
  end

  # The coordinators limited to time slots that include this meeting: they hear about every
  # change to its schedule (the whole group's coordinators don't, as there'd be too many)
  def slot_coordinators(meeting)
    User.where(id: active_memberships.where(can_schedule_hosts: true, host_slots_only: true).where.not(role: "admin")
                                     .where("? = ANY(group_memberships.host_meeting_ids)", meeting.id).select(:user_id))
  end
  # Members marked as able to host or co-host (by an admin or a host coordinator): they read the
  # documents kept for hosts (the format) and are the ones asked when a host won't be there
  def can_host?(user) = hosts_editable_by?(user) || records_editable_by?(user) || !!membership_for(user)&.then { |m| m.active? && m.can_host }
  def host_pool = User.where(id: active_memberships.where(can_host: true).select(:user_id))
  # Who may rearrange the group's HostDecks (the layout editor): its admins always, and the roles
  # it picked in Group settings (deck_editors): host coordinators and record keepers unless it
  # changed that, and everyone who can host if it chose to
  DECK_EDITOR_ROLES = %w[host_coordinators record_keepers hosts].freeze
  def decks_editable_by?(user)
    return false unless user
    return true if manageable_by?(user)

    roles = Array(deck_editors)
    (roles.include?("host_coordinators") && hosts_editable_by?(user)) || (roles.include?("record_keepers") && records_editable_by?(user)) ||
      (roles.include?("hosts") && can_host?(user))
  end

  def member_or_site_admin?(user) = !!user && (user.suite_admin? || member?(user))
  # Record keepers write the group's documents (and, later, minutes and decisions): group
  # admins, site admins, and members an admin marked in the Members tab
  def records_editable_by?(user) = manageable_by?(user) || !!membership_for(user)&.then { |m| m.active? && m.can_keep_records }
  # Who keeps the group's records: its admins and the members they marked (told when members
  # suggest agenda items, or a term is up)
  # Who writes the treasurer's reports: record keepers, and members an admin marked as treasurer
  def treasury_editable_by?(user) = records_editable_by?(user) || !!membership_for(user)&.then { |m| m.active? && m.can_keep_treasury }
  def record_keepers = User.where(id: active_memberships.where("group_memberships.role = 'admin' OR group_memberships.can_keep_records").select(:user_id))
  # How many people make a quorum, from the bylaws: a number, or a share of the members
  def quorum_needed
    return (active_memberships.count * quorum_percent / 100.0).ceil if quorum_percent&.positive?

    quorum_count if quorum_count&.positive?
  end

  def visible_to?(user) = !!user && (user.suite_admin? || member?(user) || (active? && self.class.feature_open_to?(user)))
  def active? = status == "active"
  def page_visible_to?(user) = active? || visible_to?(user)
  def admins = members.merge(GroupMembership.admins)
  def custom_page? = !page_blocks.nil?

  # Notes members shared to the group, newest first; a note stops showing when its author
  # leaves
  def shared_notes = timeline_notes.shown.where(user_id: members.select(:id)).includes(user: { avatar_attachment: :blob }).newest_first

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
