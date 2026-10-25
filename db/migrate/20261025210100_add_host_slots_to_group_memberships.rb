# A host coordinator can look after the whole group (the default) or only some of its weekly
# meetings (time slots): their open places, sub requests and schedule changes
class AddHostSlotsToGroupMemberships < ActiveRecord::Migration[8.0]
  def change
    add_column :group_memberships, :host_slots_only, :boolean, default: false, null: false
    add_column :group_memberships, :host_meeting_ids, :bigint, array: true, default: [], null: false
  end
end
