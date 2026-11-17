# How far someone has read in a chat channel (ChatChannel.unread_counts)
class ChatRead < ApplicationRecord
  belongs_to :chat_channel
  belongs_to :user

  # Moves their place forward to `message_id` (never back)
  def self.mark!(channel, user, message_id)
    upsert({ chat_channel_id: channel.id, user_id: user.id, last_read_message_id: message_id.to_i },
           unique_by: %i[chat_channel_id user_id],
           on_duplicate: Arel.sql("last_read_message_id = GREATEST(chat_reads.last_read_message_id, EXCLUDED.last_read_message_id), updated_at = CURRENT_TIMESTAMP"))
  end
end
