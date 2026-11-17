# /testflight now takes Android testers too (Google Play closed testing), not just iPhone ones
class AddPlatformToTestflightRequests < ActiveRecord::Migration[8.0]
  def change
    add_column :testflight_requests, :platform, :string, null: false, default: "ios"
  end
end
