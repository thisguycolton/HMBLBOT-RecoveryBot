# Groups, take two (see app/models/group.rb). Keeps the existing groups and the readings
# tagged to them; adds memberships with roles, OIAA-linked meetings, approved literature,
# per-group court verifications and a cached copy of OIAA's meeting directory.
class BuildOutGroups < ActiveRecord::Migration[8.0]
  def change
    change_table :groups do |t|
      t.string :slug
      t.string :time_zone, null: false, default: "America/Phoenix"
      t.string :join_token
      t.string :status, null: false, default: "active"
      t.references :created_by, foreign_key: { to_table: :users }
    end
    add_index :groups, :slug, unique: true
    add_index :groups, :join_token, unique: true

    create_table :group_memberships do |t|
      t.references :group, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :role, null: false, default: "member"
      t.string :status, null: false, default: "active"
      t.timestamps
    end
    add_index :group_memberships, %i[group_id user_id], unique: true

    change_table :meetings do |t|
      t.string :name
      t.string :recurrence, null: false, default: "weekly"
      t.integer :day_of_week
      t.integer :start_minute
      t.integer :end_minute
      t.datetime :starts_at
      t.datetime :ends_at
      t.string :time_zone, null: false, default: "America/Phoenix"
      t.string :conference_url
      t.string :conference_url_notes
      t.string :conference_phone
      t.string :location
      t.string :formatted_address
      t.string :types, array: true, null: false, default: []
      t.text :notes
      t.string :source, null: false, default: "manual"
      t.string :oiaa_slug
      t.string :oiaa_url
      t.datetime :oiaa_synced_at
      t.boolean :oiaa_missing, null: false, default: false
    end
    add_index :meetings, :oiaa_slug

    create_table :group_books do |t|
      t.references :group, null: false, foreign_key: true
      t.references :book, null: false, foreign_key: true
      t.string :note
      t.timestamps
    end
    add_index :group_books, %i[group_id book_id], unique: true

    add_reference :court_verifications, :group, foreign_key: true
    add_reference :court_verifications, :meeting, foreign_key: { on_delete: :nullify }

    add_column :users, :bio, :string
    add_column :users, :group_prompt_dismissed_at, :datetime

    # OIAA's directory, refreshed from its Meeting Guide feed (app/services/oiaa_feed.rb)
    create_table :oiaa_meetings do |t|
      t.string :slug, null: false
      t.string :name, null: false
      t.string :group_name
      t.integer :days, array: true, null: false, default: []
      t.string :start_time
      t.string :end_time
      t.string :time_zone
      t.string :conference_url
      t.string :conference_url_notes
      t.string :conference_phone
      t.string :conference_id
      t.string :types, array: true, null: false, default: []
      t.text :notes
      t.string :url
      t.datetime :last_seen_at, null: false
      t.timestamps
    end
    add_index :oiaa_meetings, :slug, unique: true
    add_index :oiaa_meetings, :conference_id
  end
end
