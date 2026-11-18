# Site notices can go to some devices only: the website, the iPhone app, the Android app (empty =
# everywhere), and in the apps only to builds older than a number, so a "how to update" notice stops
# showing once someone has updated (SiteNotice#shown_to?).
class AddTargetingToSiteNotices < ActiveRecord::Migration[8.0]
  def change
    add_column :site_notices, :platforms, :string, array: true, default: [], null: false
    add_column :site_notices, :ios_build_below, :integer
    add_column :site_notices, :android_build_below, :integer
  end
end
