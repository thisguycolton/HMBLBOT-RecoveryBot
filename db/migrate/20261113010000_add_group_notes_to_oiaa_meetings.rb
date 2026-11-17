# A listing's group description (the Meeting Guide feed's "group_notes"): what the group
# says about itself on AA Intergroup or an imported list. The group's page here shows it in
# place of the default page's welcome text. Filled in by the next feed sync / list refresh.
class AddGroupNotesToOiaaMeetings < ActiveRecord::Migration[8.0]
  def change
    add_column :oiaa_meetings, :group_notes, :text
  end
end
