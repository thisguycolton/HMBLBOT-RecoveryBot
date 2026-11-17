# The people a group's admins blocked (GroupBlock): blocking takes them out of the group and
# keeps them from asking to join or using its invite link; unblocking lets them ask again.
class Api::GroupBlocksController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_manager

  # GET /api/groups/:group_slug/blocks -> { blocks: [{ user, blocked_at, blocked_by }] }
  def index
    blocks = @group.blocks.includes(:blocked_by, user: { avatar_attachment: :blob }).order(created_at: :desc)
    render json: { blocks: blocks.map { |b| { user: b.user.as_person_json, blocked_at: b.created_at.iso8601, blocked_by: b.blocked_by&.display_name } } }
  end

  # POST /api/groups/:group_slug/blocks { user_id }
  def create
    user = User.find(params[:user_id])
    return render(json: { error: "You can't block yourself." }, status: :unprocessable_entity) if user == current_user
    if @group.admin?(user) && @group.admins.count == 1
      return render(json: { error: "A group needs at least one admin." }, status: :unprocessable_entity)
    end

    GroupBlock.transaction do
      @group.memberships.where(user: user).destroy_all
      @group.blocks.find_or_create_by!(user: user) { |b| b.blocked_by = current_user }
    end
    user.user_active_group&.destroy if user.user_active_group&.group_id == @group.id
    GroupChatChannel.channels_changed(@group)
    head :created
  end

  # DELETE /api/groups/:group_slug/blocks/:id (a user id)
  def destroy
    @group.blocks.where(user_id: params[:id]).delete_all
    head :no_content
  end
end
