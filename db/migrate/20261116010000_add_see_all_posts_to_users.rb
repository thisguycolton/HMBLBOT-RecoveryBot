# Site admins can switch their home feed (/people) to everyone's posts, not only the people
# they follow (ProfilePage#everyone_feed). Remembered per admin; ignored for everyone else.
class AddSeeAllPostsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :see_all_posts, :boolean, default: false, null: false
  end
end
