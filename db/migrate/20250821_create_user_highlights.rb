# db/migrate/20250820_create_user_highlights.rb
class CreateUserHighlights < ActiveRecord::Migration[7.1]
  def change
    create_table :user_highlights do |t|
      t.references :user, null: false, foreign_key: true
      t.references :chapter, null: false, foreign_key: true
      t.jsonb :selector, null: false, default: {}     # Web Annotation selectors
      t.jsonb :style, null: false, default: {}        # {color:"yellow"}
      t.text  :note
      t.timestamps
    end
    add_index :user_highlights, [:user_id, :chapter_id]
  end
end
