# A member's own recovery tools (Api::RecoveryController): a nightly 10th step inventory and
# a gratitude list, one of each a day, only ever seen by them; the chips they earn, in the
# design of the home group they pick (groups.chip_design, set in Group dashboard > Chips).
class CreateRecoveryTools < ActiveRecord::Migration[8.0]
  def change
    create_table :step_inventories do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.date :on, null: false
      t.jsonb :answers, null: false, default: {}
      t.text :notes, null: false, default: ""
      t.timestamps
    end
    add_index :step_inventories, %i[user_id on], unique: true

    create_table :gratitude_lists do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.date :on, null: false
      t.string :items, array: true, null: false, default: []
      t.timestamps
    end
    add_index :gratitude_lists, %i[user_id on], unique: true

    add_column :groups, :chip_design, :jsonb
    add_reference :users, :chip_group, foreign_key: { to_table: :groups, on_delete: :nullify }
  end
end
