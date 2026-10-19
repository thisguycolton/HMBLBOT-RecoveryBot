# A decision that was done once (fix a typo in the script, buy a coffee pot) stays in the log but
# isn't one of the group's standing decisions
class AddOneTimeToMotions < ActiveRecord::Migration[8.0]
  def change
    add_column :motions, :one_time, :boolean, null: false, default: false
  end
end
