# A group that doesn't run a decision by Robert's Rules can say so, and its warnings go quiet
class AddIgnoreRulesToMotions < ActiveRecord::Migration[8.0]
  def change
    add_column :motions, :ignore_rules, :boolean, null: false, default: false
  end
end
