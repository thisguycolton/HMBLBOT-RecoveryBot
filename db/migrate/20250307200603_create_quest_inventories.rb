class CreateQuestInventories < ActiveRecord::Migration[8.0]
  def change
    create_table :quest_inventories do |t|
      t.references :quest_session, null: false, foreign_key: true
      t.text :items

      t.timestamps
    end
  end
end
