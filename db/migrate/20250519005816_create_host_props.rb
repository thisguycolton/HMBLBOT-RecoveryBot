class CreateHostProps < ActiveRecord::Migration[8.0]
  def change
    create_table :host_props do |t|
      t.string :name
      t.string :proposed_meeting
      t.belongs_to :hostificator, null: false, foreign_key: true

      t.timestamps
    end
  end
end
