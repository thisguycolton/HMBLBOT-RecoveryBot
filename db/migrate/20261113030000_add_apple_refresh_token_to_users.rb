# Sign in with Apple's refresh token (encrypted, User#apple_refresh_token) and which of our
# client IDs it was issued to, so deleting the account can revoke it with Apple (AppleSignIn)
class AddAppleRefreshTokenToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :apple_refresh_token, :text
    add_column :users, :apple_client_id, :string
  end
end
