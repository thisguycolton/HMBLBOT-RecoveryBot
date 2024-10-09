class CreateMeetings < ActiveRecord::Migration[7.0]
  def change
    create_table :meetings do |t|
      t.timestamptz :datetime
      t.string :host
      t.boolean :reocurring
      t.integer :frequency
      t.references :group, null: false, foreign_key: true

      t.timestamps
    end
  end
end
