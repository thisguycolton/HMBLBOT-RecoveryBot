# Group conscience, step three: a group's business meetings (when, the agenda, the minutes) and
# the link from each decision to the meeting and agenda item it was made at.
class CreateBusinessMeetings < ActiveRecord::Migration[8.0]
  def change
    create_table :business_meetings do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      # The group event announcing it (RSVPs, the flyer, a date poll) and the regular meeting it follows
      t.references :event, foreign_key: { on_delete: :nullify }
      t.references :meeting, foreign_key: { on_delete: :nullify }
      t.date :held_on, null: false
      t.datetime :starts_at
      t.string :status, null: false, default: "planned"
      t.string :chair_name
      t.string :secretary_name
      t.integer :attendance_count
      t.text :minutes
      t.string :minutes_status, null: false, default: "draft"
      t.datetime :minutes_posted_at
      t.datetime :minutes_approved_at
      t.string :visibility, null: false, default: "members"
      t.timestamps
    end
    add_index :business_meetings, %i[group_id held_on]

    create_table :agenda_items do |t|
      t.references :business_meeting, null: false, foreign_key: { on_delete: :cascade }
      t.references :submitted_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.integer :position, null: false, default: 0
      t.string :kind, null: false, default: "new_business"
      t.string :title, null: false
      t.text :details
      t.string :status, null: false, default: "on_agenda"
      t.timestamps
    end

    add_reference :motions, :business_meeting, foreign_key: { on_delete: :nullify }
    add_reference :motions, :agenda_item, foreign_key: { on_delete: :nullify }
  end
end
