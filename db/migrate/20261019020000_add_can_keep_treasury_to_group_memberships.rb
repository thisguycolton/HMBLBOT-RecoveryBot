# The group's treasurer: a member an admin marks to write the treasurer's reports
class AddCanKeepTreasuryToGroupMemberships < ActiveRecord::Migration[8.0]
  def change
    add_column :group_memberships, :can_keep_treasury, :boolean, null: false, default: false
  end
end
