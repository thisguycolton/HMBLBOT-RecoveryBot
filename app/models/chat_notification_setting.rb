# How much of a group's chat someone hears about in the bell (and on their devices): every
# message ("all"), only @ mentions and replies to them ("mentions", what everyone starts with) or
# nothing ("none"). Set for the group as a whole (no channel) or for one channel, which wins over
# the group's. Changed from the ••• beside each channel (Api::GroupChatController#notifications).
class ChatNotificationSetting < ApplicationRecord
  LEVELS = %w[all mentions none].freeze
  DEFAULT = "mentions"

  belongs_to :user
  belongs_to :group
  belongs_to :chat_channel, optional: true

  validates :level, inclusion: { in: LEVELS }

  # { group: level, channels: { channel_id => level } } for `user` in `group` (only the channels
  # they set)
  def self.for(user, group)
    rows = where(user: user, group: group).pluck(:chat_channel_id, :level)
    { group: rows.find { |c, _| c.nil? }&.last || DEFAULT, channels: rows.select(&:first).to_h }
  end

  # The level each of these users has in `channel`: { user_id => level } (DEFAULT for anyone
  # who set nothing)
  def self.levels_in(channel, user_ids)
    rows = where(group_id: channel.group_id, user_id: user_ids).where(chat_channel_id: [nil, channel.id]).pluck(:user_id, :chat_channel_id, :level)
    user_ids.to_h do |id|
      mine = rows.select { |u, _, _| u == id }
      [id, (mine.find { |_, c, _| c } || mine.find { |_, c, _| c.nil? })&.last || DEFAULT]
    end
  end

  # The people who'd hear about every message in `channel`: anyone with "all" there, or "all" for
  # the group and nothing else set for the channel
  def self.all_user_ids(channel)
    rows = where(group_id: channel.group_id).where(chat_channel_id: [nil, channel.id]).pluck(:user_id, :chat_channel_id, :level)
    rows.group_by(&:first).filter_map do |id, mine|
      level = (mine.find { |_, c, _| c } || mine.find { |_, c, _| c.nil? }).last
      id if level == "all"
    end
  end

  # Saves `level` for `user` in `group`, or in `channel`; a channel set back to nil follows the
  # group again
  def self.set!(user, group, level, channel: nil)
    row = find_or_initialize_by(user: user, group: group, chat_channel: channel)
    return row.destroy! && nil if level.blank? && channel
    row.update!(level: level.presence || DEFAULT)
    row
  end
end
