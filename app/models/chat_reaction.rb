# One person's emoji on a chat message (ChatMessage), like Slack: as many different ones as
# they like, each once. Anyone in the channel adds or takes off their own.
class ChatReaction < ApplicationRecord
  # A message holds this many different ones at most
  KINDS_MAX = 20
  # One emoji: a picture character, with any skin tone, variation or joiner pieces it's built from
  EMOJI = /\A(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{200D}\u{20E3}#*0-9])+\z/

  belongs_to :chat_message
  belongs_to :user

  validates :emoji, format: { with: EMOJI, message: "isn't an emoji" }, length: { maximum: 16 }
  validates :user_id, uniqueness: { scope: %i[chat_message_id emoji] }
  validate(on: :create) do
    kinds = ChatReaction.where(chat_message_id: chat_message_id).distinct.pluck(:emoji)
    errors.add(:emoji, "can't go on: this message has #{KINDS_MAX} kinds already") if kinds.size >= KINDS_MAX && !kinds.include?(emoji)
  end
end
