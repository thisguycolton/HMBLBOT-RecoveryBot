# A member's share on a reading: what it brought up for them, tied to the reading instead of
# posted as a timeline note. Each one picks who it's from: the writer's name, or "A member"
# (`anonymous`, the default).
#
# Anonymity is the point, so an anonymous share never names its writer to anyone but them:
# not in its JSON (as_api_json leaves out the person), not in notifications ("A member"), not
# in the admin Reports page (Api::Admin::UserReportsController masks it) or a member's bell
# in the admin suite, and never on a profile or feed. `user_id` is still kept, so the writer
# can edit or delete it, their shares go when their account does, and blocks, mutes (ShareMute),
# reports and suspensions (users.shares_suspended_until) still work, without showing who it is.
#
# Who sees shares (readable_by?): signed-in members who can see profiles, and for a group's
# reading only that group's members and hosts (plus the reading's poster and site admins).
# Signed-out visitors and the hosting screen never see them.
#
# Each share waits for approval (`status`): the reading's poster (who posted or adopted it),
# its group's admins and site admins approve or decline (moderatable_by?). A declined share
# shows only to its writer, with the reason. An edit sends it back to waiting. A share by
# someone who can approve is approved as it's posted.
#
# A share can have replies (`parent`), one level deep, under the same rules: each picks its
# own name or "A member", waits for approval, and goes when its share does. People react to
# approved shares and replies (Reactable), shown as counts only, never who.
class ReadingShare < ApplicationRecord
  moderates_language :body
  include Reactable

  BODY_MAX = 2_000
  STATUSES = %w[pending approved declined].freeze
  # How many shares and replies one person can post in an hour (edits don't count)
  PER_HOUR = 2
  ANONYMOUS_NAME = "A member"

  belongs_to :reading
  belongs_to :user
  belongs_to :moderated_by, class_name: "User", optional: true
  belongs_to :parent, class_name: "ReadingShare", optional: true, inverse_of: :replies
  has_many :replies, class_name: "ReadingShare", foreign_key: :parent_id, inverse_of: :parent, dependent: :destroy

  validates :body, presence: true, length: { maximum: BODY_MAX }
  validates :status, inclusion: { in: STATUSES }
  validates :decline_reason, length: { maximum: 500 }
  validate :one_level_on_the_same_reading, if: :parent

  scope :approved, -> { where(status: "approved") }
  scope :pending, -> { where(status: "pending") }
  scope :top_level, -> { where(parent_id: nil) }

  before_validation :approve_own, on: :create

  def self.readable_on?(reading, viewer)
    return false unless viewer && User.profiles_open_to?(viewer) && reading.published?
    return true if moderator_of?(reading, viewer) || reading.group.nil?

    reading.group.member?(viewer) || reading.group.can_host?(viewer)
  end

  # The reading's poster (who posted or adopted it), its group's admins, and site admins
  def self.moderator_of?(reading, viewer)
    !!viewer && (reading.user_id == viewer.id || viewer.suite_admin? || !!reading.group&.admin?(viewer))
  end

  # Shares and replies on `reading` that `viewer` sees: approved ones, their own whatever their
  # state, and the waiting ones if they approve them. Shares by someone they blocked or muted
  # are left out, and so are replies whose share they can't see.
  def self.shown_to(reading, viewer)
    scope = where(reading: reading)
    scope = if moderator_of?(reading, viewer)
              scope.where(status: %w[approved pending]).or(scope.where(user_id: viewer.id))
            else
              scope.approved.or(scope.where(user_id: viewer.id))
            end
    hidden = viewer.blocked_ids | ShareMute.where(user_id: viewer.id).pluck(:muted_user_id)
    scope = scope.where.not(user_id: hidden) if hidden.any?
    list = scope.order(:created_at, :id).to_a
    ids = list.select { |s| s.parent_id.nil? }.to_set(&:id)
    list.select { |s| s.parent_id.nil? || ids.include?(s.parent_id) }
  end

  # How many approved shares `viewer` would see on each of `readings`, for the reading cards:
  # { reading_id => count }, leaving out readings whose shares they can't see
  def self.counts_for(readings, viewer)
    readings = Array(readings)
    return {} if readings.empty? || !viewer || !User.profiles_open_to?(viewer)

    my_groups = viewer.suite_admin? ? nil : GroupMembership.where(user_id: viewer.id, status: "active").pluck(:group_id).to_set
    open = readings.select do |r|
      r.published? && (my_groups.nil? || r.group_id.nil? || r.user_id == viewer.id || my_groups.include?(r.group_id))
    end
    return {} if open.empty?

    approved.top_level.where(reading_id: open.map(&:id)).where.not(user_id: viewer.blocked_ids).group(:reading_id).count
  end

  def self.posted_too_often?(user) = where(user: user).where("created_at > ?", 1.hour.ago).count >= PER_HOUR

  def readable_by?(viewer)
    return false unless self.class.readable_on?(reading, viewer)
    return false if parent && !parent.readable_by?(viewer)
    return true if user_id == viewer.id || status == "approved"

    status == "pending" && moderatable_by?(viewer)
  end

  def moderatable_by?(viewer) = self.class.moderator_of?(reading, viewer)
  def mine?(viewer) = !!viewer && viewer.id == user_id
  def removable_by?(viewer) = mine?(viewer) || !!viewer&.suite_admin?
  def reply? = parent_id.present?
  def pending? = status == "pending"
  def approved? = status == "approved"
  def declined? = status == "declined"

  # Who it's from, as anyone else sees it
  def author_name = anonymous? ? ANONYMOUS_NAME : user.display_name

  # Where its notifications go
  def page_path = "/readings/#{reading_id}#share-#{parent_id || id}"

  # The writer changes the words or who it's from. New words wait for approval again (unless
  # they can approve it themselves); showing or hiding the name doesn't.
  def revise!(body: self.body, anonymous: self.anonymous)
    self.body = body
    self.anonymous = anonymous
    if will_save_change_to_body?
      self.edited_at = Time.current
      unless moderatable_by?(user)
        self.status = "pending"
        self.moderated_by = nil
        self.moderated_at = nil
        self.decline_reason = nil
      end
    end
    save!
  end

  def approve!(by)
    first = !approved? && moderated_at.nil?
    update!(status: "approved", moderated_by: by, moderated_at: Time.current, decline_reason: nil)
    notify_reply! if first
  end

  def decline!(by, reason = nil) = update!(status: "declined", moderated_by: by, moderated_at: Time.current, decline_reason: reason.to_s.strip.first(500).presence)

  # Tells the reading's poster one is waiting, without saying who wrote it. The title alone
  # goes out (no words), so nothing personal lands on a lock screen.
  def notify_waiting!
    return unless pending?
    return if reading.user.nil? || reading.user_id == user_id

    what = reply? ? "A reply to a share" : "A share"
    Notification.deliver(reading.user, kind: "reading_share.pending", title: "#{what} on “#{reading.title}” is waiting for your approval",
                                       url: "/readings/#{reading_id}#shares", from: user)
  end

  # A reply that's showing tells its share's writer, by the name the replier chose ("A member"
  # if anonymous), unless they muted the replier. Title only.
  def notify_reply!
    return unless reply? && approved? && parent.user_id != user_id
    return if ShareMute.exists?(user_id: parent.user_id, muted_user_id: user_id)

    Notification.deliver(parent.user, kind: "reading_share.reply", title: "#{author_name} replied to your share on “#{reading.title}”",
                                      url: page_path, from: user)
  end

  # The first reaction from someone tells the writer, never who reacted
  def notify_reaction!(by)
    return if by.id == user_id || ShareMute.exists?(user_id: user_id, muted_user_id: by.id)

    what = reply? ? "reply" : "share"
    Notification.deliver(user, kind: "reading_share.reaction", title: "Someone reacted to your #{what} on “#{reading.title}”",
                               url: page_path, from: by)
  end

  # Reaction counts and the viewer's own, but never who reacted (Reactable#reactions_json
  # would list them)
  def reaction_counts_json(viewer)
    counts = NoteReaction::KINDS.index_with { |k| reactions.count { |r| r.kind == k } }
    { reactions: counts, my_reaction: reactions.find { |r| r.user_id == viewer&.id }&.kind }
  end

  # What `viewer` gets. The person is there only when it's under their name; for its writer
  # `mine` says it's theirs. Its state and any decline reason go to its writer and the people
  # who approve shares.
  def as_api_json(viewer:)
    moderator = moderatable_by?(viewer)
    json = { id: id, parent_id: parent_id, body: body, anonymous: anonymous?, name: author_name, author: (user.as_person_json unless anonymous?),
             created_at: created_at.iso8601, edited: edited_at.present?, mine: mine?(viewer), can_remove: removable_by?(viewer),
             can_moderate: moderator, **reaction_counts_json(viewer) }
    if mine?(viewer) || moderator
      json[:status] = status
      json[:decline_reason] = decline_reason
    end
    json
  end

  private

  def approve_own
    return unless reading && user && moderatable_by?(user)

    self.status = "approved"
    self.moderated_at ||= Time.current
  end

  def one_level_on_the_same_reading
    errors.add(:base, "You can only reply to a share, not to a reply.") if parent.parent_id.present?
    errors.add(:base, "That share is on another reading.") if parent.reading_id != reading_id
  end
end
