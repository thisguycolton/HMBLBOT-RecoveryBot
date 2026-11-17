# A browser or installed home-screen app that asked for Web Push notifications (account
# settings > Notifications on this device). The endpoint is the push service's address for
# that one browser; p256dh and auth are its keys, which encrypt what we send.
class CreatePushSubscriptions < ActiveRecord::Migration[8.0]
  def change
    create_table :push_subscriptions do |t|
      t.references :user, null: false, foreign_key: true
      t.text :endpoint, null: false
      t.string :p256dh, null: false
      t.string :auth, null: false
      t.string :user_agent
      t.datetime :last_sent_at
      t.timestamps
    end
    add_index :push_subscriptions, :endpoint, unique: true
  end
end
