class AddPublishedAtToReadings < ActiveRecord::Migration[8.0]
  def change
    add_column :readings, :published_at, :datetime

    # Existing readings are automatically published (set to current time)
    # This ensures they remain visible after the migration
    execute "UPDATE readings SET published_at = CURRENT_TIMESTAMP WHERE published_at IS NULL"
  end
end
