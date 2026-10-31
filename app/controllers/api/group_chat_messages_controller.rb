# One message in a group's chat: fetched when the live channel says it's new or changed
# (GroupChatChannel), changed by its writer, deleted by its writer or the group's admins. Anyone
# in its channel puts emoji on it and takes theirs off (ChatReaction).
class Api::GroupChatMessagesController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :set_message

  # GET /api/groups/:group_slug/chat_messages/:id
  def show
    render json: @message.as_api_json(viewer: current_user)
  end

  # PATCH /api/groups/:group_slug/chat_messages/:id { body } (its writer)
  def update
    return render(json: { error: "Only its writer can change it." }, status: :forbidden) unless @message.user_id == current_user.id

    @message.body = params[:body]
    @message.edited_at = Time.current if @message.body_changed?
    @message.save_and_mention!(current_user)
    render json: @message.as_api_json(viewer: current_user)
  rescue ActiveRecord::RecordInvalid
    render_errors(@message)
  end

  # DELETE /api/groups/:group_slug/chat_messages/:id (its writer or the group's admins)
  def destroy
    return render(json: { error: "You can't delete that message." }, status: :forbidden) unless @message.removable_by?(current_user)

    @message.destroy!
    head :no_content
  end

  # POST /api/groups/:group_slug/chat_messages/:id/reactions { emoji } -> the message
  def react
    return archived if @message.chat_channel.archived

    reaction = @message.reactions.find_or_initialize_by(user: current_user, emoji: params[:emoji].to_s.strip)
    return render_errors(reaction) unless reaction.persisted? || reaction.save

    changed
  rescue ActiveRecord::RecordNotUnique
    changed
  end

  # DELETE /api/groups/:group_slug/chat_messages/:id/reactions?emoji= -> the message
  def unreact
    return archived if @message.chat_channel.archived

    @message.reactions.where(user: current_user, emoji: params[:emoji].to_s.strip).delete_all
    changed
  end

  private

  # Everyone in the channel sees the reactions change
  def changed
    @message.reactions.reset
    @message.broadcast("updated")
    render json: @message.as_api_json(viewer: current_user)
  end

  def archived = render(json: { error: "This channel is archived." }, status: :unprocessable_entity)

  def set_message
    @message = ChatMessage.joins(:chat_channel).where(chat_channels: { group_id: @group.id }).find(params[:id])
    render json: { error: "Not found." }, status: :not_found unless @message.chat_channel.readable_by?(current_user)
  end
end
