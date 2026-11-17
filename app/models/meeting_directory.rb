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

  # Adds many lists at once from pasted text, one intergroup per line: "Name, feed link",
  # "feed link" alone (named after its website), or with a time zone ("Name, link,
  # America/Denver"). Tabs, semicolons and "|" work in place of commas, so a spreadsheet's
  # columns paste in. Lines without a link (a header row) are skipped, and so are links
  # already added. Returns { added: [lists], skipped: [{ line:, reason: }] }.
  def self.bulk_add(text, time_zone: "America/Phoenix")
    added = []
    skipped = []
    seen = where.not(feed_url: nil).pluck(:feed_url).to_set { |u| u.downcase.chomp("/") }
    text.to_s.each_line.map(&:strip).reject(&:empty?).first(200).each do |line|
      url = line[%r{https?://[^\s,;|"']+}i]
      next skipped << { line: line, reason: "No link in this line" } unless url

      next skipped << { line: line, reason: "Already added" } unless seen.add?(url.downcase.chomp("/"))

      parts = line.sub(url, "").split(/[\t,;|]/).map { |p| p.strip.delete_prefix('"').delete_suffix('"').strip }.reject(&:empty?)
      zone = parts.find { |p| ActiveSupport::TimeZone[p] && p.include?("/") }
      name = (parts - [zone]).join(" ").squish.presence || name_from(url)
      uri = URI(url)
      directory = new(name: name.first(120), key: unique_key(name), feed_url: url, time_zone: zone || time_zone,
                      website: "#{uri.scheme}://#{uri.host}")
      directory.save ? added << directory : skipped << { line: line, reason: directory.errors.full_messages.to_sentence }
    rescue URI::InvalidURIError
      skipped << { line: line, reason: "That link can't be read" }
    end
    { added: added, skipped: skipped }
  end

  # "https://www.aaphoenix.org/wp-admin/..." -> "aaphoenix.org"
  def self.name_from(url) = URI(url).host.to_s.delete_prefix("www.")

  def self.unique_key(name)
    base = name.to_s.parameterize.first(17).delete_suffix("-").presence || "list"
    ([base] + (2..99).map { |n| "#{base}-#{n}" }).find { |k| !exists?(key: k) }
  end

  def zone = ActiveSupport::TimeZone[time_zone]
  def slug_for(source_slug) = "#{key}-#{source_slug}"

  # When the weekly refresh will next pick this list up (nil when it doesn't refresh)
  def next_refresh_at
    return unless auto_refresh && feed_url.present?
    return Time.current unless refreshed_at

    refreshed_at + (refresh_status == "error" ? MeetingListRefresh::RETRY_AFTER : MeetingListRefresh::EVERY)
  end

  def as_admin_json
    counts = listings.group(Arel.sql("hidden_at IS NULL")).count
    {
      id: id, name: name, key: key, feed_url: feed_url, website: website, time_zone: time_zone,
      imported_at: imported_at&.iso8601, imported_by: imported_by&.display_name,
      auto_refresh: auto_refresh, refreshing: refresh_started_at.present? && refresh_started_at > MeetingListRefresh::STUCK_AFTER.ago,
      refreshed_at: refreshed_at&.iso8601, refresh_status: refresh_status, refresh_error: refresh_error,
      refresh_result: refresh_result, next_refresh_at: next_refresh_at&.iso8601,
      listed: counts[true] || 0, hidden: counts[false] || 0,
      linked: Meeting.where(oiaa_slug: listings.select(:slug)).distinct.count(:group_id),
    }
  end
end
