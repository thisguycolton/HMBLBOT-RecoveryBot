# A reading's source link (the AA Grapevine story it came from, or a Grapevine search when the
# story couldn't be matched) and when a meeting last used it, which opens a Grapevine reading's
# full text to the public for a while (Reading::GRAPEVINE_PUBLIC_WINDOW)
class AddSourceUrlAndLastUsedAtToReadings < ActiveRecord::Migration[8.0]
  def change
    add_column :readings, :source_url, :string
    add_column :readings, :last_used_at, :datetime
  end
end
