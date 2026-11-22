# A member's share on a reading: what it brought up for them, tied to the reading instead of
# posted as a timeline note. Each one picks who it's from: the writer's name, or "A member"
# (`anonymous`, the default).
#
# Anonymity is the point, so an anonymous share never names its writer to anyone but them:
# not in its JSON (as_api_json leaves out the person), not in notifications ("A member"), not
# in the admin Reports page (Api::Admin::UserReportsController masks it), and never on a
# profile or feed. `user_id` is still kept, so the writer can edit or delete it, their shares
# go when their account does, and blocks and reports still work, without showing who it is.
#
# Who sees shares (readable_by?): signed-in members who can see profiles, and for a group's
# reading only that group's members and hosts (plus the reading's poster and site admins).
# Signed-out visitors and the hosting screen never see them.
#
# Each share waits for approval (`status`): the reading's poster (who posted or adopted it),
# its group's admins and site admins approve or decline (moderatable_by?). A declined share
# shows only to its writer, with the reason. An edit sends it back to waiting. A share by
# someone who can approve is approved as it's posted.
class ReadingShare < ApplicationRecord
  moderates_language :body

  BODY_MAX = 2_000
  STATUSES = %w[pending approved declined].freeze
  # How many shares one person can post in an hour (edits don't count)
  PER_HOUR = 2
  ANONYMOUS_NAME = "A member"

  belongs_to :reading
  belongs_to :user
  belongs_to :moderated_by, class_name: "User", optional: true

  validates :body, presence: true, length: { maximum: BODY_MAX }
  validates :status, inclusion: { in: STATUSES }
  validates :decline_reason, length: { maximum: 500 }

  scope :approved, -> { where(status: "approved") }
  scope :pending, -> { where(status: "pending") }

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

  # Shares on `reading` that `viewer` sees: approved ones, their own whatever their state, and
  # the waiting ones if they approve them. Shares by someone they blocked are left out.
  def self.shown_to(reading, viewer)
    scope = where(reading: reading)
    scope = if moderator_of?(reading, viewer)
              scope.where(status: %w[approved pending]).or(scope.where(user_id: viewer.id))
            else
              scope.approved.or(scope.where(user_id: viewer.id))
            end
    blocked = viewer.blocked_ids
    scope = scope.where.not(user_id: blocked) if blocked.any?
    scope.order(:created_at, :id)
  end

  def self.posted_too_often?(user) = where(user: user).where("created_at > ?", 1.hour.ago).count >= PER_HOUR

  def readable_by?(viewer)
    return false unless self.class.readable_on?(reading, viewer)
    return true if user_id == viewer.id || status == "approved"

    status == "pending" && moderatable_by?(viewer)
  end

  def moderatable_by?(viewer) = self.class.moderator_of?(reading, viewer)
  def mine?(viewer) = !!viewer && viewer.id == user_id
  def removable_by?(viewer) = mine?(viewer) || !!viewer&.suite_admin?
  def pending? = status == "pending"
  def approved? = status == "approved"
  def declined? = status == "declined"

  # Who it's from, as anyone else sees it
  def author_name = anonymous? ? ANONYMOUS_NAME : user.display_name

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

  def approve!(by) = update!(status: "approved", moderated_by: by, moderated_at: Time.current, decline_reason: nil)
  def decline!(by, reason = nil) = update!(status: "declined", moderated_by: by, moderated_at: Time.current, decline_reason: reason.to_s.strip.first(500).presence)

  # Tells the reading's poster one is waiting, without saying who wrote it. The title alone
  # goes out (no words), so nothing personal lands on a lock screen.
  def notify_waiting!
    return unless pending?
    return if reading.user.nil? || reading.user_id == user_id

    Notification.deliver(reading.user, kind: "reading_share.pending", title: "A share on “#{reading.title}” is waiting for your approval",
                                       url: "/readings/#{reading_id}#shares", from: user)
  end

  # What `viewer` gets. The person is there only when it's under their name; for its writer
  # `mine` says it's theirs. Its state and any decline reason go to its writer and the people
  # who approve shares.
  def as_api_json(viewer:)
    moderator = moderatable_by?(viewer)
    json = { id: id, body: body, anonymous: anonymous?, name: author_name, author: (user.as_person_json unless anonymous?),
             created_at: created_at.iso8601, edited: edited_at.present?, mine: mine?(viewer), can_remove: removable_by?(viewer),
             can_moderate: moderator }
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
end
