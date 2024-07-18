class CreateOptions < ActiveRecord::Migration[7.0]
  def change
    create_table :options do |t|
      t.belongs_to :poll, null: false, foreign_key: true
      t.integer :topic_id
      t.string :topic_title

      t.timestamps
    end
  end
end
