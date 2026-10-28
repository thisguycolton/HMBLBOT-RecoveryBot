# Chips, round two: chips a group's hosts give (chip_awards, in the group's design, claimed by
# email when the person has no account yet), Meeting Maker chips from clicking Join before a
# meeting (meeting_joins, each meeting's own design in meetings.chip_design), and a member's
# chip choices: which of two chips for the same milestone shows on top, and up to five
# favorites for their profile. Earned chips are RecoveryBot's own now, so the home group goes.
class ChipsRoundTwo < ActiveRecord::Migration[8.0]
  def change
    create_table :chip_awards do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.references :given_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :user, foreign_key: { on_delete: :cascade }
      t.string :email, null: false
      t.string :milestone_key, null: false
      t.integer :years
      t.date :on, null: false
      t.text :note, null: false, default: ""
      t.string :claim_token, null: false
      t.datetime :claimed_at
      t.timestamps
    end
    add_index :chip_awards, :claim_token, unique: true
    add_index :chip_awards, :email

    create_table :meeting_joins do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.references :meeting, null: false, foreign_key: { on_delete: :cascade }
      t.datetime :starts_at, null: false
      t.timestamps
    end
    add_index :meeting_joins, %i[user_id meeting_id starts_at], unique: true

    add_column :meetings, :chip_design, :jsonb
    add_column :users, :chip_tops, :jsonb, null: false, default: {}
    add_column :users, :chip_favorites, :string, array: true, null: false, default: []
    remove_reference :users, :chip_group, foreign_key: { to_table: :groups, on_delete: :nullify }
  end
end
