# One message in a group's chat: fetched when the live channel says it's new or changed
# (GroupChatChannel), changed by its writer, deleted by its writer or the group's admins.
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

  private

  def set_message
    @message = ChatMessage.joins(:chat_channel).where(chat_channels: { group_id: @group.id }).find(params[:id])
    render json: { error: "Not found." }, status: :not_found unless @message.chat_channel.readable_by?(current_user)
  end
end
