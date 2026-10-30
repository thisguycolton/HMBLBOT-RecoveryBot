# Group admins blocking someone from their group (GroupBlock), anyone blocking someone for
# themselves (UserBlock: their posts are hidden from the blocker), and members reporting a
# chat message, note or comment to the site admins (UserReport)
class CreateGroupBlocksAndUserReports < ActiveRecord::Migration[8.0]
  def change
    create_table :group_blocks do |t|
      t.references :group, null: false, foreign_key: true, index: false
      t.references :user, null: false, foreign_key: true
      t.references :blocked_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :group_blocks, %i[group_id user_id], unique: true

    create_table :user_blocks do |t|
      t.references :blocker, null: false, foreign_key: { to_table: :users, on_delete: :cascade }, index: false
      t.references :blocked, null: false, foreign_key: { to_table: :users, on_delete: :cascade }
      t.timestamps
    end
    add_index :user_blocks, %i[blocker_id blocked_id], unique: true

    create_table :user_reports do |t|
      t.references :reporter, null: false, foreign_key: { to_table: :users, on_delete: :cascade }
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :group, foreign_key: { on_delete: :nullify }
      t.string :subject_type
      t.bigint :subject_id
      # What they wrote, kept as it was so it can be read after it's deleted
      t.text :quote, null: false, default: ""
      t.string :where_label, null: false, default: ""
      t.text :reason, null: false
      t.string :status, null: false, default: "open"
      t.references :resolved_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :resolved_at
      t.timestamps
    end
    add_index :user_reports, :status
  end
end
