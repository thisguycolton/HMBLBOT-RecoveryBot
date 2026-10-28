# Virtual chips. Round chips mark sobriety milestones and are worked out in the browser from
# the sobriety date (app/javascript/lib/milestones.js). Triangle chips mark how many 10th step
# inventories or gratitude lists a member has written, in total (a missed day never takes one
# away). Both are drawn in the design of the member's home group (ChipDesign).
module Chips
  # Triangle chips at these totals, then every year's worth after the last
  TRIANGLE_COUNTS = [1, 7, 30, 90, 180, 365].freeze
  TRIANGLE_KINDS = {
    "inventory" => { model: "StepInventory", label: "10th step", plural: "10th steps" },
    "gratitude" => { model: "GratitudeList", label: "gratitude list", plural: "gratitude lists" },
  }.freeze

  module_function

  # The counts with a chip, up to and one past `total`
  def triangle_counts(total)
    counts = TRIANGLE_COUNTS.dup
    counts << counts.last + 365 while counts.last <= total
    counts
  end

  # The chips earned for these dates (each entry's day), oldest first: [{ count:, on: }]
  def earned(days)
    sorted = days.sort
    triangle_counts(sorted.size).select { |n| n <= sorted.size }.map { |n| { count: n, on: sorted[n - 1].iso8601 } }
  end

  # The chip that saving an entry just earned, if the total landed on one
  def just_earned(before, after)
    return nil unless after > before

    triangle_counts(after).find { |n| n > before && n <= after }
  end

  def next_count(total) = triangle_counts(total).find { |n| n > total }

  # Everything the Chips page needs for one member
  def summary(user)
    TRIANGLE_KINDS.to_h do |kind, info|
      days = info[:model].constantize.where(user: user).pluck(:on)
      [kind, { total: days.size, earned: earned(days), next: next_count(days.size), label: info[:label], plural: info[:plural] }]
    end
  end
end
