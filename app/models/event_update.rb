# A change worth telling people about: an "update" note was written or changed, or
# guidelines set to notify were edited. Everyone following the event hears about it in
# the app (the bell) and by email: "<event> has an update for you!"
class EventUpdate < ApplicationRecord
  moderates_language :title, :body
  KINDS = %w[note guidelines].freeze

  belongs_to :event
  belongs_to :created_by, class_name: "User", optional: true

  validates :kind, inclusion: { in: KINDS }
  validates :title, presence: true

  after_create_commit :deliver

  # A markdown headline ("# Parking moved") is the update's title; the rest is its body
  def self.split(markdown, kind:)
    lines = markdown.to_s.strip.lines
    if lines.first&.match?(/\A\#{1,6}\s+\S/)
      title = lines.shift.sub(/\A\#{1,6}\s+/, "").strip
    else
      title = kind == "guidelines" ? "The guidelines changed" : "New update"
    end
    { title: title.first(200), body: lines.join.strip }
  end

  def notification_title = "#{event.title} has an update for you!"

  def as_api_json
    { id: id, kind: kind, title: title, body: body, created_at: created_at.iso8601 }
  end

  private

  def deliver
    rsvps = event.followers.includes(:user).to_a.reject { |r| r.user_id && r.user_id == created_by_id }
    users = rsvps.filter_map(&:user)
    Notification.deliver(users, kind: "event.update", title: notification_title, body: title, url: event.path)
    rsvps.each { |rsvp| EventMailer.with(update: self, rsvp: rsvp).update_posted.deliver_later }
    update_column(:recipients_count, rsvps.size)
  end
end
