# An elected office can have its own section on the business meeting agenda, with lines under it
# that fill in who holds it now (offices with the same heading share a section: the four host
# coordinators, say). And an office can give whoever holds it a role on the site (the secretary is
# a record keeper), set from the office's title for the offices there already.
class AddAgendaSectionToServicePositions < ActiveRecord::Migration[8.0]
  def up
    add_column :service_positions, :on_agenda, :boolean, default: false, null: false
    add_column :service_positions, :agenda_heading, :string
    add_column :service_positions, :agenda_lines, :text
    add_column :service_positions, :grants, :string
    execute "UPDATE service_positions SET grants = 'can_keep_records' WHERE title ~* '(secretar|record keeper|scribe)'"
    execute "UPDATE service_positions SET grants = 'can_keep_treasury' WHERE grants IS NULL AND title ~* 'treasur'"
    execute "UPDATE service_positions SET grants = 'can_schedule_hosts' WHERE grants IS NULL AND title ~* 'host coord'"
  end

  def down
    remove_column :service_positions, :on_agenda
    remove_column :service_positions, :agenda_heading
    remove_column :service_positions, :agenda_lines
    remove_column :service_positions, :grants
  end
end
