# Imported meeting listings were saved with HTML entities in them ("Post &amp; Wellesley"),
# and meetings linked to them copied that. Turn them back into characters; OiaaFeed.clean
# no longer adds them. Nothing else changes.
class UnescapeMeetingListingText < ActiveRecord::Migration[8.0]
  ENTITY = /&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x\h+);/i

  def up
    fix(:oiaa_meetings, %w[name group_name notes location location_notes formatted_address region conference_url_notes])
    fix(:meetings, %w[name location formatted_address notes conference_url_notes], "oiaa_slug IS NOT NULL")
  end

  def down; end

  private

  def fix(table, columns, condition = nil)
    model = Class.new(ActiveRecord::Base) { self.table_name = table }
    scope = model.where(columns.map { |c| "#{c} LIKE '%&%;%'" }.join(" OR "))
    scope = scope.where(condition) if condition
    scope.find_each do |row|
      changes = columns.each_with_object({}) do |c, h|
        value = row[c]
        next unless value.is_a?(String) && value.match?(ENTITY)

        fixed = value
        2.times { fixed = CGI.unescapeHTML(fixed) }
        h[c] = fixed.tr(" ", " ")
      end
      row.update_columns(changes) if changes.any?
    end
  end
end
