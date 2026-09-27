class CreateSharingModes < ActiveRecord::Migration[7.0]
  def change
    create_table :sharing_modes do |t|
      t.string :key, null: false
      t.string :name, null: false
      t.string :icon_name
      t.text :prompt, null: false
      t.boolean :gentle, null: false, default: false
      t.integer :position, null: false, default: 0
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :sharing_modes, :key, unique: true
  end
end
