# Sign in with Apple (AppleSignIn, NativeSignIn): the Apple account a member signed in with,
# so they're found again even if they hid their email or changed it
class AddAppleUidToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :apple_uid, :string
    add_index :users, :apple_uid, unique: true
  end
end
