# The welcome wizard after sign-up (/welcome): set when someone finishes or skips it. Everyone
# who already has an account counts as done, so only new accounts are sent through it.
class AddOnboardedAtToUsers < ActiveRecord::Migration[8.0]
  def up
    add_column :users, :onboarded_at, :datetime
    execute "UPDATE users SET onboarded_at = created_at"
  end

  def down
    remove_column :users, :onboarded_at
  end
end
