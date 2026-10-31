# A member's gratitude list for one day. Only its owner ever sees it
# (Api::GratitudeListsController).
class GratitudeList < ApplicationRecord
  moderates_language :items
  include RecoveryEntry

  MAX_ITEMS = 50

  before_validation { self.items = Array(items).map { |i| i.to_s.squish.first(500) }.compact_blank.first(MAX_ITEMS) }

  def blank_entry? = items.empty?

  def as_api_json = { on: on.iso8601, items: items, updated_at: updated_at&.iso8601 }
end
