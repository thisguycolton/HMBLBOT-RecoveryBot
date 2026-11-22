# A decision's own public link (/d/:token), off unless a record keeper turns it on
class AddShareTokenToMotions < ActiveRecord::Migration[8.0]
  def change
    add_column :motions, :share_token, :string
    add_column :motions, :shared_at, :datetime
    add_reference :motions, :shared_by, foreign_key: { to_table: :users, on_delete: :nullify }, index: false
    add_index :motions, :share_token, unique: true
  end
end
