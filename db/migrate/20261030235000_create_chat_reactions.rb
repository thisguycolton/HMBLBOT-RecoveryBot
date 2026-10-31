# Emoji reactions on group chat messages (ChatReaction): each person puts on any emoji once.
class CreateChatReactions < ActiveRecord::Migration[8.0]
  def change
    create_table :chat_reactions do |t|
      t.references :chat_message, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :emoji, null: false
      t.timestamps
    end
    add_index :chat_reactions, %i[chat_message_id emoji user_id], unique: true
  end
end
