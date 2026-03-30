class CreateReadingTags < ActiveRecord::Migration[8.0]
  def change
    create_table :reading_tags do |t|
      t.references :reading, null: false, foreign_key: true
      t.references :tag, null: false, foreign_key: true

      t.timestamps
    end
    add_index :reading_tags, [:reading_id, :tag_id], unique: true
  end
end
