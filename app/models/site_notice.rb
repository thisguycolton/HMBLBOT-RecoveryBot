# A site-wide announcement from an admin. It shows as a toast on every page until the
# reader dismisses it, then stays hidden in that browser for a day (components/SiteNotices.jsx).
# A notice with a body has its own write-up page at /notices/:id that the toast links to.
class SiteNotice < ApplicationRecord
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

  # What this visitor should see: members-only notices need an account, guest notices
  # (say, "sign up for highlights") go only to people who aren't signed in
  def self.for_viewer(user)
    live.where(audience: ["everyone", user ? "members" : "guests"]).order(created_at: :desc)
  end

  def live?
    active? && (starts_at.nil? || starts_at <= Time.current) && (ends_at.nil? || ends_at > Time.current)
  end

  def write_up? = body.present?

  # The toast's "Read more" link: the write-up page, or the admin's own link
  def read_more_url
    write_up? ? "/notices/#{id}" : link_url.presence
  end

  def as_api_json
    {
      id: id, title: title, summary: summary, tone: tone, url: read_more_url,
      # the toast's link text; an admin's link text labels the button on the write-up instead
      link_label: write_up? ? "Read more" : link_label.presence || "Open",
      # a dismissal is remembered against this, so editing a notice shows it again
      version: updated_at.to_i,
    }
  end

  def as_page_json
    as_api_json.merge(body: body, link_url: link_url.presence, link_label: link_label.presence,
                      published_at: (starts_at || created_at).iso8601)
  end

  def as_admin_json
    as_page_json.merge(
      link_label: link_label, audience: audience, active: active, live: live?,
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
