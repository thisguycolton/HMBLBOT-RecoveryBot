# ACID QUEST needs its sharing modes (Story, Check-In, ...) to offer topics. Production gets
# them here, once, when the table is still empty; db/seeds.rb also re-imports topics from a
# CSV, which production shouldn't run. Rolling back leaves the modes in place.
class SeedSharingModes < ActiveRecord::Migration[8.0]
  def up
    SharingMode.reset_column_information
    load Rails.root.join("db/seeds/sharing_modes.rb") unless SharingMode.exists?
  end

  def down; end
end
