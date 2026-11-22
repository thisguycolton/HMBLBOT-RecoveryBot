# Members' shares on a reading (ReadingShare): what the reading brought up for them, posted under
# their name or as "A member". Each waits for the reading's poster (or its group's admins, or a
# site admin) to approve it. `user_id` is always kept, for editing, deleting and stopping abuse,
# but an anonymous share never shows it to anyone else. Its poster can turn shares off (`shares_off`).
class CreateReadingShares < ActiveRecord::Migration[8.0]
  def change
    create_table :reading_shares do |t|
      t.references :reading, null: false, foreign_key: true, index: false
      t.references :user, null: false, foreign_key: true, index: false
      t.text :body, null: false
      t.boolean :anonymous, null: false, default: true
      t.string :status, null: false, default: "pending"
      t.references :moderated_by, foreign_key: { to_table: :users }
      t.datetime :moderated_at
      t.text :decline_reason
      t.datetime :edited_at
      t.timestamps
    end
    add_index :reading_shares, %i[reading_id status created_at]
    add_index :reading_shares, %i[user_id created_at]

    add_column :readings, :shares_off, :boolean, null: false, default: false
  end
end
