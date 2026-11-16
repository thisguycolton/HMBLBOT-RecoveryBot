# Site admins can take back a chip someone got by mistake (Site Admin > Members > Chips) and pick
# another in that milestone's stack. The chip's row stays, marked revoked, so its number stays
# used and a Special Edition can't be claimed or earned again; chip_revocations is the record of
# who did it, when, and what it was swapped for.
class CreateChipRevocations < ActiveRecord::Migration[8.0]
  def change
    add_column :chip_awards, :revoked_at, :datetime
    add_column :chip_edition_chips, :revoked_at, :datetime

    create_table :chip_revocations do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :revoked_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :chip_id, null: false
      t.string :slot, null: false
      t.string :label, null: false, default: ""
      t.jsonb :chip, null: false, default: {}
      t.string :replacement_id
      t.jsonb :replacement
      t.text :note, null: false, default: ""
      t.integer :posts_swapped, null: false, default: 0
      t.integer :posts_hidden, null: false, default: 0
      t.timestamps
    end
  end
end
