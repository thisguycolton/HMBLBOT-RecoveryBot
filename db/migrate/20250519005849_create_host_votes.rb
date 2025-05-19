class CreateHostVotes < ActiveRecord::Migration[8.0]
  def change
    create_table :host_votes do |t|
      t.string :session_id
      t.belongs_to :hostificator, null: false, foreign_key: true
      t.belongs_to :host_prop, null: false, foreign_key: true
      t.integer :weight, default: 1

      t.timestamps
    end

    add_index :host_votes, [:session_id, :hostificator_id], unique: true
  end
end
