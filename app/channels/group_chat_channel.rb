# A group's chat, live (components/groups/chat): a member listens to each channel they're in
# and hears which message was posted, changed or deleted (ChatMessage#broadcast; the page
# fetches it), who's typing, and when the list of channels changed. Subscribe again after
# that, since who's in a channel may have changed.
class GroupChatChannel < ApplicationCable::Channel
  # params: group (slug)
  def subscribed
    @group = Group.find_by(slug: params[:group])
    membership = @group&.membership_for(current_user)
    return reject unless current_user && membership&.active?

    @channels = @group.chat_channels.open.select { |c| c.readable_by?(current_user, membership) }
    @channels.each { |c| stream_from c.stream }
    stream_from self.class.group_stream(@group)
  end

  # { channel_id } -> the channel hears { type: "typing", channel_id, user: { id, name } }
  def typing(data)
    channel = @channels&.find { |c| c.id == data["channel_id"].to_i } or return

    ActionCable.server.broadcast(channel.stream, { type: "typing", channel_id: channel.id,
                                                   user: { id: current_user.id, name: current_user.display_name } })
  end

  def self.group_stream(group) = "group_chat:#{group.id}"

  # Everyone with the chat open reloads the list of channels
  def self.channels_changed(group)
    ActionCable.server.broadcast(group_stream(group), { type: "channels" })
  end
end
