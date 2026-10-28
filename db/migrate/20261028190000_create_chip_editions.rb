# Special Editions: limited chips a group makes for a window of time (ChipEdition), and each
# one someone has (ChipEditionChip), numbered in the order they were claimed or earned
class CreateChipEditions < ActiveRecord::Migration[8.0]
  def change
    create_table :chip_editions do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :name, null: false
      t.string :kind, null: false, default: "milestone"
      t.jsonb :design, null: false, default: {}
      t.date :starts_on, null: false
      t.date :ends_on, null: false
      t.string :window, null: false, default: "custom"
      t.string :milestones, array: true, null: false, default: []
      t.bigint :meeting_ids, array: true, null: false, default: []
      t.integer :target_count
      t.string :how_many, null: false, default: "everyone"
      t.integer :limit
      t.boolean :numbered, null: false, default: true
      t.datetime :published_at
      t.datetime :locked_at
      t.timestamps
    end

    create_table :chip_edition_chips do |t|
      t.references :chip_edition, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, foreign_key: { on_delete: :cascade }
      t.references :chip_award, foreign_key: { on_delete: :cascade }
      t.string :slot, null: false
      t.string :milestone_key
      t.integer :years
      t.integer :count
      t.date :earned_on, null: false
      t.integer :serial, null: false
      t.datetime :claimed_at
      t.timestamps
    end
    add_index :chip_edition_chips, %i[chip_edition_id serial], unique: true
    add_index :chip_edition_chips, %i[chip_edition_id user_id slot], unique: true, where: "chip_award_id IS NULL", name: "index_edition_chips_once_per_slot"

    add_reference :chip_awards, :chip_edition, foreign_key: { on_delete: :nullify }
  end
end
