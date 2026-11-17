class CreateHostSubRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :host_sub_requests do |t|
      t.references :meeting, null: false, foreign_key: true
      t.references :requested_by, foreign_key: { to_table: :users }
      t.references :filled_by, foreign_key: { to_table: :users }
      t.string :role, null: false
      t.date :on, null: false
      t.string :note
      t.string :status, null: false, default: "open"
      t.timestamps
    end
    add_index :host_sub_requests, %i[meeting_id role on status]
  end
end
