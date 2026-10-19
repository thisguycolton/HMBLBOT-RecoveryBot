# Members who can host or co-host the group's meetings: they read the format and hear when a
# scheduled host won't be there
class AddCanHostToGroupMemberships < ActiveRecord::Migration[8.0]
  def change
    add_column :group_memberships, :can_host, :boolean, null: false, default: false
  end
end
