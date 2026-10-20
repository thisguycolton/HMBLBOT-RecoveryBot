# The Hosting Command Center (/groups/:slug/host/:meeting_id): what a group gives the hosts of a
# meeting (its script, the chat postings to paste, readings to share on screen), and the live
# state of a meeting being hosted, which the host and co-host share.
class CreateHostingCommandCenter < ActiveRecord::Migration[8.0]
  def change
    # A meeting's kit, or the group's default kit when meeting_id is nil
    create_table :hosting_kits do |t|
      t.references :group, null: false, foreign_key: true
      t.references :meeting, index: false, foreign_key: { on_delete: :cascade }
      t.references :script_document, foreign_key: { to_table: :group_documents, on_delete: :nullify }
      t.jsonb :readings, null: false, default: []
      # Where the day's reading or activity goes in the script: the text of the paragraph it
      # follows (nil: found by itself, "none": the script has no such spot)
      t.text :activity_anchor
      # The service the hosts line people up for ([{ key, label }]; nil: the usual ones), named in
      # the script as {{ service_KEY }}
      t.jsonb :service_roles
      t.timestamps
    end
    add_index :hosting_kits, :group_id, unique: true, where: "meeting_id IS NULL", name: "index_hosting_kits_one_default"
    add_index :hosting_kits, :meeting_id, unique: true, where: "meeting_id IS NOT NULL", name: "index_hosting_kits_one_per_meeting"

    create_table :host_chat_postings do |t|
      t.references :hosting_kit, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false
      t.string :icon
      t.integer :minute, null: false, default: 0
      t.text :body, null: false, default: ""
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    # One meeting on one date, as its host and co-host run it
    create_table :hosting_sessions do |t|
      t.references :meeting, null: false, foreign_key: { on_delete: :cascade }
      t.date :on, null: false
      t.integer :section_index, null: false, default: 0
      t.jsonb :completed, null: false, default: []
      t.jsonb :posted, null: false, default: {}
      # What the hosts did, newest last ({ by, text, at }), so each sees what the other has done
      t.jsonb :log, null: false, default: []
      # The reading or activity the hosts picked for the day (a chapter, today's daily reading,
      # Topicificator topics, a speaker...)
      t.jsonb :activity
      # Who is doing which service today ({ key => name }), and who is celebrating a milestone
      # ([{ id, name, length, done }])
      t.jsonb :service, null: false, default: {}
      t.jsonb :milestones, null: false, default: []
      t.datetime :timer_started_at
      t.integer :timer_banked, null: false, default: 0
      t.integer :version, null: false, default: 0
      t.timestamps
    end
    add_index :hosting_sessions, %i[meeting_id on], unique: true

    # Who has the Command Center open, and what they last did
    create_table :hosting_presences do |t|
      t.references :hosting_session, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :activity
      t.integer :section_index
      t.datetime :last_seen_at, null: false
      t.timestamps
    end
    add_index :hosting_presences, %i[hosting_session_id user_id], unique: true
  end
end
