# A local meeting list imported next to AA Intergroup's online directory: an area
# intergroup's in-person meetings, from its Meeting Guide feed or a JSON/CSV file
# (MeetingListImport). Its listings are OiaaMeeting rows, so Find a meeting, the default
# group pages and linking a group's meetings work on them the same way.
#
# `key` prefixes its listings' slugs ("phx-monday-night-group"), so they never collide
# with AA Intergroup's or another list's.
class MeetingDirectory < ApplicationRecord
  belongs_to :imported_by, class_name: "User", optional: true
  has_many :listings, class_name: "OiaaMeeting", dependent: :restrict_with_error

  before_validation { self.key = key.to_s.parameterize.first(20).presence || name.to_s.parameterize.first(20) }

  validates :name, presence: true, length: { maximum: 120 }
  validates :key, presence: true, uniqueness: true, format: { with: /\A[a-z0-9][a-z0-9-]*\z/ }
  validates :feed_url, format: { with: %r{\Ahttps?://}i, message: "must start with http:// or https://" }, allow_blank: true
  validates :website, format: { with: %r{\Ahttps?://}i, message: "must start with http:// or https://" }, allow_blank: true
  validate { errors.add(:time_zone, "isn't a time zone we know") unless ActiveSupport::TimeZone[time_zone.to_s] }

  def zone = ActiveSupport::TimeZone[time_zone]
  def slug_for(source_slug) = "#{key}-#{source_slug}"

  def as_admin_json
    counts = listings.group(Arel.sql("hidden_at IS NULL")).count
    {
      id: id, name: name, key: key, feed_url: feed_url, website: website, time_zone: time_zone,
      imported_at: imported_at&.iso8601, imported_by: imported_by&.display_name,
      listed: counts[true] || 0, hidden: counts[false] || 0,
      linked: Meeting.where(oiaa_slug: listings.select(:slug)).distinct.count(:group_id),
    }
  end
end
