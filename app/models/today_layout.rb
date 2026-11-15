# How a member arranged their Today panel (users.today_layout): { "order" => [section ids],
# "hidden" => [section ids] }. Nil means the default (SECTIONS in this order, all shown).
# Sections the client doesn't list (a new one added later) take their default place there.
module TodayLayout
  SECTIONS = %w[greeting day_count admin_tasks attention covers meetings birthdays events].freeze

  def self.normalize(raw)
    return nil unless raw.is_a?(Hash)

    order = Array(raw["order"] || raw[:order]).map(&:to_s).select { |id| SECTIONS.include?(id) }.uniq
    hidden = Array(raw["hidden"] || raw[:hidden]).map(&:to_s).select { |id| SECTIONS.include?(id) }.uniq
    { "order" => order, "hidden" => hidden }
  end
end
