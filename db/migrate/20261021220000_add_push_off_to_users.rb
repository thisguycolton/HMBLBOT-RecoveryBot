# The kinds of notification an account doesn't want pushed to its devices (Notification::PUSH_CATEGORIES
# keys). They still show in the bell. Empty means everything is pushed, as before.
class AddPushOffToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :push_off, :string, array: true, default: [], null: false
  end
end
