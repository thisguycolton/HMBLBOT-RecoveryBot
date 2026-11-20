# A site-wide announcement from an admin. It shows as a toast on every page until the
# reader dismisses it, then stays hidden in that browser for a day (components/SiteNotices.jsx).
# A notice with a body (Markdown) opens it in a modal from the toast's "Read more".
class SiteNotice < ApplicationRecord
  moderates_language :title, :summary, :body, :link_label
  TONES = %w[info success warning].freeze
  # app_push_off: signed in on the iPhone or Android app, on a phone that isn't getting
  # notifications (for nudges like "turn on notifications for your reminders")
  AUDIENCES = %w[everyone members guests app_push_off].freeze
  # Where it shows. None picked = everywhere.
  PLATFORMS = %w[web ios android].freeze

  belongs_to :user, optional: true

  validates :title, presence: true, length: { maximum: 120 }
  validates :summary, length: { maximum: 240 }
  validates :tone, inclusion: { in: TONES }
  validates :audience, inclusion: { in: AUDIENCES }
  validates :link_url, format: { with: %r{\A(https?://|/(?!/))}i, message: "must start with https:// or /" }, allow_blank: true
  validates :ios_build_below, :android_build_below, numericality: { only_integer: true, greater_than: 1 }, allow_nil: true
  validate :ends_after_start

  before_validation { self.platforms = Array(platforms).map(&:to_s).compact_blank.uniq & PLATFORMS }

  # Switched on, started and not yet over
  scope :live, lambda {
    now = Time.current
    where(active: true)
      .where("starts_at IS NULL OR starts_at <= ?", now)
      .where("ends_at IS NULL OR ends_at > ?", now)
  }

  # Notices about getting the app (a TestFlight or Google Play invite, "add it to your home
  # screen") make no sense to someone already using the iPhone or Android app, so the apps
  # (NativeAppRequest#native_app?) don't get them. A notice counts when its link goes to an install
  # or app store page, or its title or summary names TestFlight, the App Store or Google Play.
  APP_LINK = %r{\A(/install|/testflight)(\z|[/?#])|\Ahttps?://([a-z0-9-]+\.)*(testflight\.apple\.com|apps\.apple\.com|play\.google\.com)(\z|[/?#:])}i
  APP_WORDS = /\b(testflight|app store|google play|play store)\b/i

  # What this visitor should see: members-only notices need an account, guest notices
  # (say, "sign up for highlights") go only to people who aren't signed in. platform is "web",
  # "ios" or "android" and build the app's build number (shown_to?). push is what the app says
  # about this phone's notifications (true, false or nil when it didn't say; push_off_in_app?).
  def self.for_viewer(user, platform: "web", build: nil, push: nil)
    audiences = ["everyone", user ? "members" : "guests"]
    audiences << "app_push_off" if push_off_in_app?(user, platform, push)
    live.where(audience: audiences).order(created_at: :desc)
        .select { |notice| notice.shown_to?(platform, build) }
  end

  # Signed in on the app, and this phone isn't getting notifications: the app says they're off
  # here (no permission, turned off in settings, or a build without notifications), or the
  # account has no notification token for this kind of phone at all (DeviceToken).
  def self.push_off_in_app?(user, platform, push)
    return false unless user && %w[ios android].include?(platform)
    push == false || !user.device_tokens.exists?(platform: platform)
  end

  # A notice picked for some devices goes only there, and in an app with "builds older than" only
  # to older builds. An app build too old to say its number (before the App plugin, iPhone build 1)
  # counts as older than everything. A notice for everywhere that's about getting the app skips the
  # apps; one picked for the apps on purpose (say, how to update in TestFlight) doesn't.
  def shown_to?(platform, build = nil)
    platform = "web" unless %w[ios android].include?(platform)
    return false if platforms.any? && !platforms.include?(platform)
    return !about_getting_the_app? if platforms.empty? && platform != "web"

    below = build_below(platform)
    below.nil? || build.to_i < below
  end

  def build_below(platform) = { "ios" => ios_build_below, "android" => android_build_below }[platform]

  def about_getting_the_app?
    link_url.to_s.strip.match?(APP_LINK) || [title, summary].any? { |t| t.to_s.match?(APP_WORDS) }
  end

  # Picked for the apps on purpose, so the "about getting the app" rule doesn't hide it there
  def hidden_in_app? = platforms.empty? && about_getting_the_app?

  def live?
    active? && (starts_at.nil? || starts_at <= Time.current) && (ends_at.nil? || ends_at > Time.current)
  end

  def write_up? = body.present?

  # What the toast and its modal need. With a write-up, "Read more" opens the modal and the
  # admin's link becomes a button at its end; without one, the toast links straight out.
  def as_api_json
    {
      id: id, title: title, summary: summary, tone: tone, body: body.presence,
      link_url: link_url.presence, link_label: link_label.presence,
      published_at: (starts_at || created_at).iso8601,
      # a dismissal is remembered against this, so editing a notice shows it again
      version: updated_at.to_i,
    }
  end

  def as_admin_json
    as_api_json.merge(
      link_label: link_label, audience: audience, active: active, live: live?,
      hidden_in_app: hidden_in_app?,
      platforms: platforms, ios_build_below: ios_build_below, android_build_below: android_build_below,
      starts_at: starts_at&.iso8601, ends_at: ends_at&.iso8601,
      author: user&.name.presence || user&.email, created_at: created_at.iso8601, updated_at: updated_at.iso8601,
    )
  end

  private

  def ends_after_start
    return unless starts_at && ends_at && ends_at <= starts_at
    errors.add(:ends_at, "must be after it starts")
  end
end
