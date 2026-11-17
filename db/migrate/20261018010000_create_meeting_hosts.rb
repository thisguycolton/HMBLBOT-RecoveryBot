# Who hosts and co-hosts each of a group's weekly meetings. A group can have dozens (28 a week
# is four a day), so this is its own schedule, apart from the elected officials. Names are plain
# text (first name and last initial); user_id is only so someone can be told they've been put on.
class CreateMeetingHosts < ActiveRecord::Migration[8.0]
  def change
    create_table :meeting_hosts do |t|
      t.references :meeting, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, foreign_key: { on_delete: :nullify }
      t.string :role, null: false
      t.string :name, null: false
      t.date :starts_on, null: false
      t.date :ends_on
      t.timestamps
    end
    add_index :meeting_hosts, %i[meeting_id role starts_on]

    # Someone covering one date of a meeting (a swap), for the host or the co-host
    create_table :meeting_host_covers do |t|
      t.references :meeting, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, foreign_key: { on_delete: :nullify }
      t.string :role, null: false
      t.string :name, null: false
      t.date :on, null: false
      t.timestamps
    end
    add_index :meeting_host_covers, %i[meeting_id role on], unique: true

    # The person who schedules hosts needn't keep the group's records
    add_column :group_memberships, :can_schedule_hosts, :boolean, null: false, default: false
  end
end
