# A group that doesn't run its business by Robert's Rules turns the rules' warnings off for good
class AddFollowsRobertsRulesToGroups < ActiveRecord::Migration[8.0]
  def change
    add_column :groups, :follows_roberts_rules, :boolean, null: false, default: true
  end
end
