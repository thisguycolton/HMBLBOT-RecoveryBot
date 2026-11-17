# Sign up and log in with Google (Users::OmniauthCallbacksController). google_uid is Google's
# id for the person (the "sub"), so the link holds even if either email changes later.
# password_chosen is false for an account Google made: it has a random password nobody
# knows, so the profile lets them set one without typing a current password.
class AddGoogleSignInToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :google_uid, :string
    add_column :users, :password_chosen, :boolean, default: true, null: false
    add_index :users, :google_uid, unique: true
  end
end
