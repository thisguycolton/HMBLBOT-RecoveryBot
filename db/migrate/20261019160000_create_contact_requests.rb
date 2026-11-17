class CreateContactRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_requests do |t|
      t.string :name
      t.string :email, null: false
      t.string :topic, null: false, default: "general"
      t.text :message, null: false
      t.references :user, foreign_key: { on_delete: :nullify }
      t.string :status, null: false, default: "open"
      t.datetime :handled_at
      t.references :handled_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :contact_requests, %i[status created_at]
  end
end
