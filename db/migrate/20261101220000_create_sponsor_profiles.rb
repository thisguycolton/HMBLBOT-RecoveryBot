# "Available to sponsor" (SponsorProfile), and a group's switch for listing its members who
# are (groups.show_sponsors)
class CreateSponsorProfiles < ActiveRecord::Migration[8.0]
  def change
    create_table :sponsor_profiles do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.boolean :available, null: false, default: false
      t.text :note
      t.string :picks, array: true, null: false, default: []
      t.string :languages
      t.boolean :show_time_sober, null: false, default: false
      t.integer :max_sponsees
      t.datetime :stopped_at
      t.references :stopped_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_column :groups, :show_sponsors, :boolean, null: false, default: true
  end
end
