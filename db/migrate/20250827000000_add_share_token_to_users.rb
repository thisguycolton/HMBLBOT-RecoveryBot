class AddShareTokenToUsers < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!  # optional, if you want large updates to commit in batches

  def change
    add_column :users, :share_token, :string
    add_index  :users, :share_token, unique: true

    # Data migration inline
    reversible do |dir|
      dir.up do
        say_with_time "Populating share_token for existing users" do
          # minimal AR class bound to current table schema
          Class.new(ActiveRecord::Base) do
            self.table_name = "users"
          end.find_each do |u|
            u.update_columns(share_token: SecureRandom.urlsafe_base64(16))
          end
        end
      end
    end
  end
end
