# The channels in a group's chat and their messages. Whoever the admins let (Group#chat_creatable_by?)
# adds channels; admins and a channel's maker change who's in it, rename or archive it. Members
# of a channel read and post in it; messages arrive live (GroupChatChannel).
class Api::GroupChatChannelsController < ApplicationController
  include GroupScoped

  PAGE = 50
  # Opening on a message (from a notification, a pin or a reply): this many before it for
  # context, and up to this many from it to the newest
  CONTEXT = 10
  FROM_MAX = 1000

  before_action :set_group
  before_action :require_chat_member
  before_action :set_channel, except: :create

  # POST /api/groups/:group_slug/chat_channels { name, topic, access_roles: [], access_user_ids: [] } -> the channel
  def create
    return render(json: { error: "Your group's admins haven't let you add channels." }, status: :forbidden) unless @group.chat_creatable_by?(current_user)

    channel = @group.chat_channels.new(created_by: current_user, **channel_params)
    channel.access_user_ids |= [current_user.id] unless channel.readable_by?(current_user)
    return render_errors(channel) unless channel.save

    GroupChatChannel.channels_changed(@group)
    render json: channel.as_api_json(viewer: current_user), status: :created
  end

  # PATCH /api/groups/:group_slug/chat_channels/:id { name, topic, access_roles, access_user_ids, archived }
  def update
    return forbidden("Only admins and whoever added this channel can change it.") unless @channel.manageable_by?(current_user)

    @channel.assign_attributes(channel_params)
    @channel.archived = ActiveModel::Type::Boolean.new.cast(params[:archived]) if params.key?(:archived)
    if @channel.general? && (@channel.name_changed? || @channel.archived || !@channel.everyone?)
      return render(json: { error: "#general stays open to everyone in the group." }, status: :unprocessable_entity)
    end
    return render_errors(@channel) unless @channel.save

    GroupChatChannel.channels_changed(@group)
    render json: @channel.as_api_json(viewer: current_user)
  end

  # DELETE /api/groups/:group_slug/chat_channels/:id -> it and its messages, for good (admins)
  def destroy
    return forbidden("Only this group's admins can delete a channel.") unless @group.manageable_by?(current_user)
    return render(json: { error: "#general can't be deleted." }, status: :unprocessable_entity) if @channel.general?

    @channel.destroy!
    GroupChatChannel.channels_changed(@group)
    head :no_content
  end

  # GET /api/groups/:group_slug/chat_channels/:id/messages?before=ID -> { messages (oldest first), more, last_read }
  # ?from=ID instead gives everything from a little before that message to the newest one
  def messages
    scope = message_scope(@channel.messages).order(id: :desc)
    page = from_page(scope, params[:from].to_i) if params[:from].present?
    unless page
      scope = scope.where(id: ...params[:before].to_i) if params[:before].present?
      page = scope.limit(PAGE + 1).to_a
      more = page.size > PAGE
      page = page.first(PAGE)
    end
    more = page.any? && scope.where(id: ...page.last.id).exists? if more.nil?
    read = ChatRead.find_by(chat_channel: @channel, user: current_user)&.last_read_message_id || 0
    render json: { messages: messages_json(page.reverse), more: more, last_read: read }
  end

  # GET /api/groups/:group_slug/chat_channels/:id/pins -> { messages } (the newest pin first)
  def pins
    render json: { messages: messages_json(message_scope(@channel.messages.where.not(pinned_at: nil)).order(pinned_at: :desc).to_a) }
  end

  # POST /api/groups/:group_slug/chat_channels/:id/messages { body, reply_to_id? } -> the message
  def post_message
    return render(json: { error: "This channel is archived." }, status: :unprocessable_entity) if @channel.archived

    message = @channel.messages.new(user: current_user, body: params[:body])
    if params[:reply_to_id].present?
      message.reply_to = @channel.messages.find_by(id: params[:reply_to_id])
      return render(json: { error: "The message you're replying to isn't here anymore." }, status: :unprocessable_entity) unless message.reply_to
    end
    message.save_and_mention!(current_user)
    ChatRead.mark!(@channel, current_user, message.id)
    render json: message.as_api_json(viewer: current_user), status: :created
  rescue ActiveRecord::RecordInvalid
    render_errors(message)
  end

  # POST /api/groups/:group_slug/chat_channels/:id/read { message_id } -> read up to there
  def read
    ChatRead.mark!(@channel, current_user, params[:message_id] || @channel.messages.maximum(:id).to_i)
    head :no_content
  end

  private

  def message_scope(scope)
    scope.includes({ user: { avatar_attachment: :blob } }, { reactions: :user }, { reply_to: :user }, :pinned_by)
  end

  def messages_json(list)
    can = ChatMessage.permissions(@channel, current_user)
    list.map { |m| m.as_api_json(viewer: current_user, can: can) }
  end

  # From CONTEXT messages before `id` to the newest (newest first), or nil when that's too many
  def from_page(scope, id)
    start = scope.where(id: ...id).offset(CONTEXT - 1).pick(:id) || 0
    page = scope.where(id: start..).limit(FROM_MAX + 1).to_a
    page unless page.size > FROM_MAX
  end

  def require_chat_member
    return if @group.member?(current_user)

    render json: { error: "Only members of this group can use its chat." }, status: :forbidden
  end

  def set_channel
    @channel = @group.chat_channels.find(params[:id])
    render json: { error: "Not found." }, status: :not_found unless @channel.readable_by?(current_user)
  end

  def channel_params
    attrs = params.permit(:name, :topic, access_roles: [], access_user_ids: []).to_h.symbolize_keys
    if attrs.key?(:access_user_ids)
      attrs[:access_user_ids] = @group.active_memberships.where(user_id: Array(attrs[:access_user_ids]).compact_blank).pluck(:user_id)
    end
    attrs[:access_roles] = [] if params.key?(:access_roles) && params[:access_roles].blank?
    attrs
  end

  def forbidden(message) = render(json: { error: message }, status: :forbidden)
end
