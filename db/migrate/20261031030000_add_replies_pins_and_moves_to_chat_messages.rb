# Group chat messages that answer another (reply_to_id: kept when that one is deleted, so the
# reply can say so), that are pinned in their channel, and that an admin moved from another
# channel.
class AddRepliesPinsAndMovesToChatMessages < ActiveRecord::Migration[8.0]
  def change
    change_table :chat_messages, bulk: true do |t|
      t.bigint :reply_to_id
      t.datetime :pinned_at
      t.references :pinned_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.bigint :moved_from_channel_id
      t.datetime :moved_at
    end
    add_index :chat_messages, :reply_to_id
    add_index :chat_messages, %i[chat_channel_id pinned_at], where: "pinned_at IS NOT NULL", name: "index_chat_messages_pinned"
  end
end
