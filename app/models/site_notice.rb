# A site-wide announcement from an admin. It shows as a toast on every page until the
# reader dismisses it, then stays hidden in that browser for a day (components/SiteNotices.jsx).
# A notice with a body (Markdown) opens it in a modal from the toast's "Read more".
class SiteNotice < ApplicationRecord
  moderates_language :title, :summary, :body, :link_label
  TONES = %w[info success warning].freeze
  AUDIENCES = %w[everyone members guests].freeze

  belongs_to :user, optional: true

  validates :title, presence: true, length: { maximum: 120 }
  validates :summary, length: { maximum: 240 }
  validates :tone, inclusion: { in: TONES }
  validates :audience, inclusion: { in: AUDIENCES }
  validates :link_url, format: { with: %r{\A(https?://|/(?!/))}i, message: "must start with https:// or /" }, allow_blank: true
  validate :ends_after_start

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
  # (say, "sign up for highlights") go only to people who aren't signed in. in_app leaves out
  # notices about getting the app.
  def self.for_viewer(user, in_app: false)
    notices = live.where(audience: ["everyone", user ? "members" : "guests"]).order(created_at: :desc).to_a
    in_app ? notices.reject(&:about_getting_the_app?) : notices
  end

  def about_getting_the_app?
    link_url.to_s.strip.match?(APP_LINK) || [title, summary].any? { |t| t.to_s.match?(APP_WORDS) }
  end

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
      hidden_in_app: about_getting_the_app?,
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
