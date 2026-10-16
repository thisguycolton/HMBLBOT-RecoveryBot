# Group pages in the HMBLBOT Editor, the default page AA Intergroup groups (and groups
# that haven't made their own) show, and members' timeline notes shared to their groups.
class CreateGroupPages < ActiveRecord::Migration[8.0]
  def change
    change_table :groups, bulk: true do |t|
      t.string :page_layout, null: false, default: "main_side"
      # nil until the group saves its own page; until then it shows the default page
      t.jsonb :page_blocks
    end

    create_table :group_page_templates do |t|
      t.string :key, null: false
      t.string :layout, null: false, default: "main_side"
      t.jsonb :blocks, null: false, default: []
      t.references :updated_by, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :group_page_templates, :key, unique: true

    create_table :timeline_notes do |t|
      t.references :user, null: false, foreign_key: true
      t.text :body, null: false
      t.timestamps
    end
    add_index :timeline_notes, %i[user_id created_at]

    create_table :timeline_note_shares do |t|
      t.references :timeline_note, null: false, foreign_key: true
      t.references :group, null: false, foreign_key: true
      t.timestamps
    end
    add_index :timeline_note_shares, %i[timeline_note_id group_id], unique: true
    add_index :timeline_note_shares, %i[group_id created_at]
  end
end
