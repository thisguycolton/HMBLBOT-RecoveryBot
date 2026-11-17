# The RecoveryBot Facebook Page the day's Daily Reflection goes to as a Story (DailyStory),
# and the Instagram business account linked to it. Only one: Site Admin > Daily story
# connects it (Facebook's sign-in, or a pasted Page token) and sets when it posts.
#
# The Page token is encrypted in the database. One made from a long-lived sign-in doesn't
# expire on its own, but stops working if the person who connected it changes their Facebook
# password, removes the app or stops managing the Page; a failed post tells the site admins.
class FacebookPageConnection < ApplicationRecord
  belongs_to :connected_by, class_name: "User", optional: true

  serialize :page_choices, coder: JSON
  encrypts :page_token, :page_choices

  validates :post_at, format: { with: /\A([01]\d|2[0-3]):[0-5]\d\z/ }
  validates :look, inclusion: { in: QuoteCard::LOOKS }
  validate :known_time_zone

  def self.current = first_or_create!

  def connected? = page_id.present? && page_token.present?

  def instagram? = instagram_id.present?

  # Pages to pick from after signing in with an account that manages several
  def choices = Array(page_choices)

  # Points it at a Page: { "id", "name", "access_token", "instagram_business_account" => { "id", "username" } }
  def connect!(page, user:)
    ig = page["instagram_business_account"] || {}
    update!(page_id: page["id"].to_s, page_name: page["name"], page_token: page["access_token"],
            instagram_id: ig["id"]&.to_s, instagram_username: ig["username"], instagram_enabled: ig["id"].present? && instagram_enabled,
            page_choices: nil, connected_by: user, connected_at: Time.current)
  end

  def disconnect!
    update!(page_id: nil, page_name: nil, page_token: nil, instagram_id: nil, instagram_username: nil, page_choices: nil,
            enabled: false, instagram_enabled: false, connected_by: nil, connected_at: nil)
  end

  def zone = ActiveSupport::TimeZone[time_zone] || ActiveSupport::TimeZone["America/Phoenix"]

  # When it next posts (nil when it's off or not connected)
  def next_post_at(now = Time.current)
    return nil unless enabled && connected?

    local = now.in_time_zone(zone)
    hours, mins = post_at.split(":").map(&:to_i)
    at = local.change(hour: hours, min: mins)
    at += 1.day if at <= local || posted_on == local.to_date
    at
  end

  def as_admin_json
    {
      connected: connected?, page_id: page_id, page_name: page_name, instagram_username: instagram_username, instagram: instagram?,
      choices: choices.map { |c| { id: c["id"], name: c["name"], instagram_username: c.dig("instagram_business_account", "username") } },
      connected_by: connected_by&.display_name, connected_at: connected_at&.iso8601,
      enabled: enabled, instagram_enabled: instagram_enabled, post_at: post_at, time_zone: time_zone, look: look,
      posting: posting_started_at.present? && posting_started_at > DailyStory::STUCK_AFTER.ago,
      next_post_at: next_post_at&.iso8601, app_configured: MetaGraph.configured?,
    }
  end

  private

  def known_time_zone
    errors.add(:time_zone, "isn't one we know") unless ActiveSupport::TimeZone[time_zone]
  end
end
