# A message in a group's chat channel (ChatChannel): Markdown like a note, edited or deleted
# by its writer (the group's admins delete any). Its @ mentions notify people (Mentionable).
# Anyone in the channel puts emoji on it (ChatReaction) and replies to it, which tells its writer.
# Whoever manages the channel pins it there; the group's admins move it (and the replies under
# it) to another channel when it went in the wrong one.
class ChatMessage < ApplicationRecord
  include Mentionable

  BODY_MAX = 4000
  # How much of the message a reply shows it answered
  QUOTE_MAX = 160

  belongs_to :chat_channel
  belongs_to :user
  has_many :reactions, -> { order(:id) }, class_name: "ChatReaction", dependent: :delete_all
  # What it answers; the id stays when that one is deleted, so the reply can say so
  belongs_to :reply_to, class_name: "ChatMessage", optional: true
  has_many :replies, class_name: "ChatMessage", foreign_key: :reply_to_id, inverse_of: :reply_to
  belongs_to :pinned_by, class_name: "User", optional: true

  before_validation { self.body = body.to_s.gsub("\r\n", "\n").strip }
  validates :body, presence: true, length: { maximum: BODY_MAX }
  validate(on: :create) { errors.add(:reply_to, "isn't in this channel") if reply_to && reply_to.chat_channel_id != chat_channel_id }

  after_create_commit { chat_channel.update_column(:last_message_at, created_at) }
  after_create_commit { broadcast("created") }
  after_update_commit { broadcast("updated") }
  after_destroy_commit { broadcast("deleted") }

  def group = chat_channel.group
  def path = "/groups/#{group.slug}/messages/#{chat_channel_id}?m=#{id}"

  # Saves it, then tells who it newly @ mentions (if they're in the channel), and, when it's a
  # new reply, whoever wrote the message it answers (unless they were mentioned anyway)
  def save_and_mention!(author)
    channel = chat_channel
    replying = new_record? && reply_to
    people = take_mentions(body, author: author, groups: [group],
                                 everyone: group.manageable_by?(author) && channel.readers,
                                 can_see: ->(u) { channel.readable_by?(u) })
    save!
    tell_mentioned(people, kind: "mention.chat", body: body.truncate(200), url: path, from: author,
                           title: ->(handle) { "#{author.display_name} mentioned #{handle ? "@#{handle}" : 'you'} in ##{channel.name}" })
    tell_replied_to(author) if replying && people.keys.none? { |u| u.id == reply_to.user_id }
  end

  # What the viewer may do to it, worked out once for a page of them (ChatMessage.permissions)
  def self.permissions(channel, viewer)
    admin = channel.group.manageable_by?(viewer)
    { admin: admin, pin: admin || channel.manageable_by?(viewer) }
  end

  def removable_by?(viewer, can = ChatMessage.permissions(chat_channel, viewer)) = user_id == viewer&.id || can[:admin]

  def pinned? = pinned_at.present?

  # Pins it in its channel, or takes the pin off (without counting as an edit; the caller tells
  # the channel)
  def pin!(by, on)
    update_columns(pinned_at: on ? Time.current : nil, pinned_by_id: on ? by.id : nil)
  end

  # Moves it, and every reply under it, to `channel` (in the same group): they come out of the
  # one they were in, live, and go into that one as if they'd been changed there, in the order
  # they were written. Mentions and emoji go along; nobody is told again. Gives their ids.
  def move_to!(channel)
    from = chat_channel
    ids = thread_ids
    ChatMessage.transaction do
      ChatMessage.where(id: ids).update_all(chat_channel_id: channel.id, moved_from_channel_id: from.id, moved_at: Time.current, updated_at: Time.current)
      [from, channel].each { |c| c.update_column(:last_message_at, c.messages.maximum(:created_at)) }
    end
    ids.each do |id|
      ActionCable.server.broadcast(from.stream, { type: "deleted", channel_id: from.id, id: id })
      ActionCable.server.broadcast(channel.stream, { type: "updated", channel_id: channel.id, id: id })
    end
    reload
    ids
  end

  # It and the replies under it (and theirs), in its channel
  def thread_ids
    ids = [id]
    level = [id]
    while (level = ChatMessage.where(chat_channel_id: chat_channel_id, reply_to_id: level).where.not(id: ids).pluck(:id)).any?
      ids.concat(level)
    end
    ids
  end

  # For a list of them: preload `reply_to: :user, reactions: :user` and pass `can`
  def as_api_json(viewer:, can: ChatMessage.permissions(chat_channel, viewer))
    {
      id: id, channel_id: chat_channel_id, body: body, mentions: mentions,
      author: user.as_person_json, created_at: created_at.iso8601, edited: edited_at.present?,
      mine: user_id == viewer&.id, mentions_me: mentions?(viewer), can_remove: removable_by?(viewer, can),
      # From someone the viewer blocked: shown folded up, opened only if they ask
      blocked: !!viewer&.blocked?(user),
      reactions: reactions_json(viewer),
      reply_to: reply_to_json(viewer),
      pinned: pinned? ? { at: pinned_at.iso8601, by: pinned_by&.display_name } : nil,
      moved_from: moved_from_channel_id && { id: moved_from_channel_id, name: ChatChannel.where(id: moved_from_channel_id).pick(:name) },
      can_pin: can[:pin], can_move: can[:admin],
    }
  end

  # The message it answers, cut short: who wrote it and its start (or that it's gone, or in
  # another channel now, after a move)
  def reply_to_json(viewer)
    return nil unless reply_to_id
    return { id: reply_to_id, gone: true } unless reply_to

    { id: reply_to.id, channel_id: reply_to.chat_channel_id, author: { id: reply_to.user_id, name: reply_to.user.display_name },
      excerpt: reply_to.body.gsub(/\s+/, " ").truncate(QUOTE_MAX), blocked: !!viewer&.blocked?(reply_to.user) }
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

  private

  def tell_replied_to(author)
    person = reply_to.user
    return if person.id == author.id || !chat_channel.readable_by?(person)

    Notification.deliver(person, kind: "reply.chat", title: "#{author.display_name} replied to you in ##{chat_channel.name}",
                                 body: body.truncate(200), url: path, from: author)
  end
end
