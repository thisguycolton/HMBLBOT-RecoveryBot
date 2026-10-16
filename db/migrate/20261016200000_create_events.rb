# Group events, built in the HMBLBOT Editor: a page of blocks in one of three layouts, with
# collaborators, RSVPs (accounts or just an email), updates sent to everyone following it,
# and the schedule polls that pick its time.
class CreateEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :events do |t|
      t.references :group, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :token, null: false
      t.string :title, null: false
      t.string :short_description
      t.string :layout, null: false, default: "main_side"
      t.string :status, null: false, default: "draft"
      t.string :time_zone, null: false, default: "America/Phoenix"
      t.datetime :starts_at
      t.datetime :ends_at
      t.string :location
      t.jsonb :blocks, null: false, default: []
      t.datetime :published_at
      t.timestamps
    end
    add_index :events, :token, unique: true

    create_table :event_collaborators do |t|
      t.references :event, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.references :added_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :event_collaborators, %i[event_id user_id], unique: true

    # going / maybe / following (voted in one of its polls) / not_going (no more updates)
    create_table :event_rsvps do |t|
      t.references :event, null: false, foreign_key: true
      t.references :user, foreign_key: true
      t.string :email
      t.string :name
      t.string :status, null: false, default: "going"
      t.string :token, null: false
      t.timestamps
    end
    add_index :event_rsvps, :token, unique: true
    add_index :event_rsvps, %i[event_id user_id], unique: true, where: "user_id IS NOT NULL"
    add_index :event_rsvps, "event_id, LOWER(email)", unique: true, where: "user_id IS NULL", name: "index_event_rsvps_on_event_and_guest_email"

    create_table :event_updates do |t|
      t.references :event, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :block_id
      t.string :kind, null: false
      t.string :title, null: false
      t.text :body
      t.integer :recipients_count, null: false, default: 0
      t.timestamps
    end

    add_reference :schedule_polls, :event, foreign_key: true
  end
end
