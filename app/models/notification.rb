# Something for one account to see in the notification center (the bell in the nav).
# Create them with Notification.deliver; the nav polls Api::NotificationsController.
class Notification < ApplicationRecord
  belongs_to :user

  validates :kind, :title, presence: true

  # What account settings > Notifications on this device lets people turn off for push, by
  # kind. Turned-off kinds still show in the bell; kinds not listed here are always pushed.
  # admin_only: only offered to site admins (User#suite_admin?).
  PUSH_CATEGORIES = {
    "host_reminders" => { label: "Host reminders", description: "Before each meeting you host, co-host or cover (if reminders are on under Hosting).",
                          kinds: %w[meeting_host.reminder] },
    "host_schedule" => { label: "Host schedule changes", description: "When you're put on a schedule, assigned a role or covering for someone, and changes in the time slots you coordinate.",
                         kinds: %w[meeting_host.assigned meeting_host.covering meeting_host.linked meeting_host.slot_changed] },
    "sub_requests" => { label: "Sub requests", description: "When a host needs someone to fill in, and when someone takes it.",
                        kinds: %w[meeting_host.sub_needed meeting_host.sub_found] },
    "business" => { label: "Business meetings and service", description: "Business meetings scheduled, minutes posted, agenda items suggested, service terms ending.",
                    kinds: %w[business_meeting.scheduled business_meeting.minutes agenda_item.suggested service.rotation service.term_ending] },
    "groups" => { label: "Your groups", description: "Added to a group, a join request approved or asked for, a group you followed arriving.",
                  kinds: %w[group.added group.joined group.approved group.join_request group.followed_arrived] },
    "events" => { label: "Events", description: "Updates to events you RSVP'd to, and being added as an event collaborator.",
                  kinds: %w[event.update event.collaborator] },
    "schedule_polls" => { label: "Scheduling polls", description: "Being asked to vote or help run a poll, and new votes in polls you run.",
                          kinds: %w[schedule_poll.invitee schedule_poll.collaborator schedule_poll.vote] },
    "mentions" => { label: "Mentions and replies", description: "When someone @ mentions you, or a role you hold, in chat, a note, a comment or a highlight note, and when someone replies to your chat message.",
                    kinds: %w[mention.chat mention.note reply.chat] },
    "comments" => { label: "Comments on your notes", description: "When someone comments on one of your notes.",
                    kinds: %w[note.comment] },
    "profile_notes" => { label: "Notes on your page", description: "When someone writes a note on your profile.",
                         kinds: %w[note.on_profile] },
    "document_comments" => { label: "Comments on group documents", description: "New comments on documents you saved, and replies in comment threads you're in.",
                             kinds: %w[document.comment] },
    "reactions" => { label: "Reactions and reposts", description: "When someone reacts to your notes, highlights or comments, or reposts a note or highlight.",
                     kinds: %w[note.reaction comment.reaction highlight.reaction note.repost] },
    "follows" => { label: "New followers", description: "When someone follows you.", kinds: %w[follow.created] },
    "chips" => { label: "Chips", description: "When someone gives you a chip, you earn a Special Edition, or your group makes a new one.",
                 kinds: %w[chip.given chip.edition chip.edition_new] },
    "sponsorship" => { label: "Sponsorship", description: "When someone asks you to be their sponsor or says yes, when a sponsee sends you something, and when your sponsor leaves a note on it.",
                       kinds: %w[sponsorship.request sponsorship.accepted sponsorship.share sponsorship.reply] },
    "recovery_reminders" => { label: "Gratitude and 10th step reminders", description: "The daily reminders you turned on under Reminders.",
                              kinds: %w[recovery.gratitude_reminder recovery.step_reminder] },
    "site_admin" => { label: "Site admin", description: "New groups waiting for approval, text reports and reports about people.",
                      kinds: %w[group.pending text_report.created user_report.created], admin_only: true },
  }.freeze
  PUSH_CATEGORY_BY_KIND = PUSH_CATEGORIES.flat_map { |key, c| c[:kinds].map { |k| [k, key] } }.to_h.freeze

  # Also sent to the account's devices that turned on push (WebPushSender)
  after_create_commit :push_later, if: -> { WebPushSender.configured? && user.wants_push?(kind) && user.push_subscriptions.exists? }

  scope :unread, -> { where(read_at: nil) }
  scope :recent, -> { order(created_at: :desc, id: :desc) }

  # Notification.deliver(users, kind: "text_report.created", title: "...", body: "...", url: "/...")
  # `from` is who did it, when it's something a person did to them (a comment, a mention, a
  # follow): people who blocked them (UserBlock) aren't told.
  def self.deliver(users, kind:, title:, body: nil, url: nil, from: nil)
    users = Array(users).uniq
    users -= User.where(id: UserBlock.where(blocked_id: from.id).select(:blocker_id)).to_a if from && users.any?
    users.each { |user| create!(user: user, kind: kind, title: title, body: body&.truncate(300), url: url) }
  end

  def read? = read_at.present?

  # Its PUSH_CATEGORIES key, or nil (always pushed)
  def self.push_category(kind) = PUSH_CATEGORY_BY_KIND[kind]

  # Where a push notification's tap goes: marks it read, then on to its url
  def open_path = "/notifications/#{id}/open"

  def as_api_json
    { id: id, kind: kind, title: title, body: body, url: url, read: read?, created_at: created_at.iso8601 }
  end

  private

  def push_later
    WebPushJob.perform_later(self)
  end
end
