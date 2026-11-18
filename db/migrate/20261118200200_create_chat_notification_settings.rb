# How much of a group's chat tells someone in the bell (ChatNotificationSetting): "all" messages,
# only "mentions" (and replies, the default) or "none", for the whole group (chat_channel_id nil)
# or one channel, which wins over the group's. And when they saw (or closed) the one-time banner
# in the chat that says they can change it.
class CreateChatNotificationSettings < ActiveRecord::Migration[8.0]
  def change
    create_table :chat_notification_settings do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.references :group, null: false, foreign_key: true
      t.references :chat_channel, foreign_key: true
      t.string :level, null: false
      t.timestamps
    end
    add_index :chat_notification_settings, %i[user_id group_id], unique: true, where: "chat_channel_id IS NULL", name: "index_chat_notify_on_user_group"
    add_index :chat_notification_settings, %i[user_id chat_channel_id], unique: true, where: "chat_channel_id IS NOT NULL", name: "index_chat_notify_on_user_channel"
    add_column :users, :chat_notify_nudged_at, :datetime
  end
end
