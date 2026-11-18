# Each build of the iPhone and Android apps, with its release notes (AppRelease). Account settings >
# App info lists them, and Site Admin > App releases keeps them. Starts with the builds made so far;
# only the first of each is marked out, so mark the rest out in Site Admin once testers have them.
class CreateAppReleases < ActiveRecord::Migration[8.0]
  RELEASES = [
    ["ios", 1, "1.0", "2026-11-13", "The first test build of RecoveryBot for iPhone: your day count, readings, meetings, groups and chat in an app, with notifications."],
    ["ios", 2, "1.0", nil, "- Pages appear as soon as you tap, with placeholders while the rest loads\n- The background behind pages follows Dark Mode"],
    ["ios", 3, "1.0", nil, "- New: lock the app with Face ID, Touch ID or your passcode (Account settings > This phone)"],
    ["ios", 4, "1.0", nil, "- Pick a style for each Home Screen widget, with previews\n- Widgets use the site's fonts"],
    ["ios", 5, "1.0", nil, "- New Home Screen widget designs\n- New Daily Reflection widget\n- The day count widget shows your progress around its edge"],
    ["android", 1, "1.0", "2026-11-13", "The first test build of RecoveryBot for Android: your day count, readings, meetings, groups and chat in an app, with notifications."],
    ["android", 2, "1.0.1", "2026-11-14", "- Smaller, faster app\n- Pages draw behind the status and navigation bars\n- Fixed the day count widget saying \"Can't load widget\""],
    ["android", 3, "1.0.2", "2026-11-16", "- No more blank screen when the first page can't load\n- Removed the extra title bar\n- Day count and chip widgets each get their own style\n- A clearer message when Google sign-in is cancelled"],
    ["android", 4, "1.0.3", nil, "- New: lock the app with your fingerprint, face or screen lock (Account settings > This phone)"],
    ["android", 5, "1.0.4", nil, "- Pick a style for each widget, with previews\n- Widgets use the site's fonts"],
    ["android", 6, "1.0.5", nil, "- New widget designs\n- New Daily Reflection widget"],
  ].freeze

  def change
    create_table :app_releases do |t|
      t.string :platform, null: false
      t.integer :build, null: false
      t.string :version, null: false
      t.text :notes
      t.date :released_on
      t.timestamps
    end
    add_index :app_releases, %i[platform build], unique: true

    reversible do |dir|
      dir.up do
        now = Time.current
        rows = RELEASES.map do |platform, build, version, released_on, notes|
          { platform: platform, build: build, version: version, released_on: released_on, notes: notes, created_at: now, updated_at: now }
        end
        insert = Class.new(ActiveRecord::Base) { self.table_name = "app_releases" }
        insert.reset_column_information
        insert.insert_all!(rows)
      end
    end
  end
end
