# The group setup guide (/groups/:slug/setup): which of its steps a group's admins have done or
# skipped, and when they finished or put it away. Groups that already exist are treated as set up,
# so only new ones get the guide.
class AddSetupToGroups < ActiveRecord::Migration[8.0]
  def up
    add_column :groups, :setup_steps, :jsonb, default: {}, null: false
    add_column :groups, :setup_finished_at, :datetime
    execute "UPDATE groups SET setup_finished_at = created_at"
  end

  def down
    remove_column :groups, :setup_steps
    remove_column :groups, :setup_finished_at
  end
end
