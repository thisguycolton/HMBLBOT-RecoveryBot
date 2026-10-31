# A message in a group's chat channel (ChatChannel): Markdown like a note, edited or deleted
# by its writer (the group's admins delete any). Its @ mentions notify people (Mentionable).
# Anyone in the channel puts emoji on it (ChatReaction).
class ChatMessage < ApplicationRecord
  include Mentionable

  BODY_MAX = 4000

  belongs_to :chat_channel
  belongs_to :user
  has_many :reactions, -> { order(:id) }, class_name: "ChatReaction", dependent: :delete_all

  before_validation { self.body = body.to_s.gsub("\r\n", "\n").strip }
  validates :body, presence: true, length: { maximum: BODY_MAX }

  after_create_commit { chat_channel.update_column(:last_message_at, created_at) }
  after_create_commit { broadcast("created") }
  after_update_commit { broadcast("updated") }
  after_destroy_commit { broadcast("deleted") }

  def group = chat_channel.group
  def path = "/groups/#{group.slug}/messages/#{chat_channel_id}?m=#{id}"

  # Saves it, then tells who it newly @ mentions (if they're in the channel)
  def save_and_mention!(author)
    channel = chat_channel
    people = take_mentions(body, author: author, groups: [group],
                                 everyone: group.manageable_by?(author) && channel.readers,
                                 can_see: ->(u) { channel.readable_by?(u) })
    save!
    tell_mentioned(people, kind: "mention.chat", body: body.truncate(200), url: path, from: author,
                           title: ->(handle) { "#{author.display_name} mentioned #{handle ? "@#{handle}" : 'you'} in ##{channel.name}" })
  end

  def removable_by?(viewer) = user_id == viewer&.id || group.manageable_by?(viewer)

  def as_api_json(viewer:)
    {
      id: id, channel_id: chat_channel_id, body: body, mentions: mentions,
      author: user.as_person_json, created_at: created_at.iso8601, edited: edited_at.present?,
      mine: user_id == viewer&.id, mentions_me: mentions?(viewer), can_remove: removable_by?(viewer),
      # From someone the viewer blocked: shown folded up, opened only if they ask
      blocked: !!viewer&.blocked?(user),
      reactions: reactions_json(viewer),
    }
  end

  # Each emoji on it, in the order they first went on, with how many, whether the viewer's is
  # one, and who (leaving out the names of people the viewer blocked; preload
  # `reactions: :user` for a list of messages)
  def reactions_json(viewer)
    blocked = viewer ? viewer.blocked_ids : []
    reactions.group_by(&:emoji).map do |emoji, list|
      { emoji: emoji, count: list.size, mine: list.any? { |r| r.user_id == viewer&.id },
        names: list.reject { |r| blocked.include?(r.user_id) }.map { |r| r.user_id == viewer&.id ? "You" : r.user.display_name } }
    end
  end


  # Everyone listening hears which message changed; they fetch it, since the production cable
  # (Postgres) can't carry a long one
  def broadcast(type)
    ActionCable.server.broadcast("chat:#{chat_channel_id}", { type: type, channel_id: chat_channel_id, id: id, user_id: user_id })
  end
end
