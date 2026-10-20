# Hosts' own reminders before a meeting they host or co-host (set in their account settings),
# the reminders already sent (one per person, meeting, place and date), and a group setting
# to show who hosts on its public meeting schedule
class AddHostRemindersAndPublicHosts < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :host_reminders, :boolean, default: false, null: false
    add_column :users, :host_reminder_hours, :integer, default: 24, null: false
    add_column :users, :host_reminder_email, :boolean, default: true, null: false
    add_column :groups, :show_hosts_publicly, :boolean, default: true, null: false

    create_table :meeting_host_reminders do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :meeting, null: false, foreign_key: { on_delete: :cascade }
      t.string :role, null: false
      t.date :on, null: false
      t.datetime :created_at, null: false
    end
    add_index :meeting_host_reminders, %i[user_id meeting_id role on], unique: true, name: "index_meeting_host_reminders_once"
  end
end
