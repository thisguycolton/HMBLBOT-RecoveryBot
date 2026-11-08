# One day's Daily Reflection Story (DailyStory): posted to the Page (and Instagram), only partly
# (one of them failed), or not at all, and why.
class DailyStoryPost < ApplicationRecord
  STATUSES = %w[posted partial failed].freeze

  belongs_to :user, optional: true

  validates :status, inclusion: { in: STATUSES }

  scope :recent, -> { order(created_at: :desc, id: :desc) }

  def as_admin_json
    { id: id, on: on.iso8601, status: status, chapter_title: chapter_title, clips: clips, facebook_ids: facebook_ids,
      instagram_ids: instagram_ids, error: error, triggered_by: triggered_by, by: user&.display_name, at: created_at.iso8601 }
  end
end
