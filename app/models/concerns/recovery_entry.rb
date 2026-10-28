# What a 10th step inventory and a gratitude list share: one a day for each member, on a
# date the member's own calendar gives (their browser sends it, so "today" is theirs).
module RecoveryEntry
  extend ActiveSupport::Concern

  included do
    belongs_to :user
    validates :on, presence: true, uniqueness: { scope: :user_id }
    validate { errors.add(:on, "can't be in the future") if on && on > Date.current + 1 }
    validate { errors.add(:on, "is too long ago") if on && on.year < 1950 }
  end

  class_methods do
    # "2026-10-27" -> a Date, or nil for anything else
    def parse_day(value)
      Date.iso8601(value.to_s) if value.to_s.match?(/\A\d{4}-\d{2}-\d{2}\z/)
    rescue Date::Error
      nil
    end
  end
end
