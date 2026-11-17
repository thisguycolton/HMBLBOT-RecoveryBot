# People asking to be invited to the iPhone app's TestFlight beta (/testflight)
class CreateTestflightRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :testflight_requests do |t|
      t.string :name, null: false
      t.string :email, null: false
      t.text :note
      t.references :user, foreign_key: { on_delete: :nullify }
      t.string :status, null: false, default: "new"
      t.datetime :invited_at
      t.references :handled_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :testflight_requests, [:status, :created_at]
    add_index :testflight_requests, :email
  end
end
