# The iPhone and Android apps' notification tokens (Firebase Cloud Messaging), one per install
# that turned notifications on; FcmSender sends each Notification to them, beside Web Push
class CreateDeviceTokens < ActiveRecord::Migration[8.0]
  def change
    create_table :device_tokens do |t|
      t.references :user, null: false, foreign_key: true
      t.text :token, null: false
      t.string :platform, null: false
      t.string :app_version
      t.datetime :last_sent_at
      t.timestamps
    end
    add_index :device_tokens, :token, unique: true
  end
end
