# Highlights only reach a timeline once their reader shares one (UserHighlight#shared_at).
# Ones already set to Followers or Members stay shared, dated when they were made; private
# ones stay private.
class AddSharedAtToUserHighlights < ActiveRecord::Migration[8.0]
  def up
    add_column :user_highlights, :shared_at, :datetime
    add_index :user_highlights, [:user_id, :shared_at]
    execute "UPDATE user_highlights SET shared_at = created_at WHERE visibility <> 'private'"
  end

  def down
    remove_column :user_highlights, :shared_at
  end
end
