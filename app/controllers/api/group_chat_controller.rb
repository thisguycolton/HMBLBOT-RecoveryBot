# A group's chat (ChatChannel): the channels a member is in with what they haven't read, and
# who may add channels, which the group's admins pick (roles from ChatChannel::ROLES, and people).
class Api::GroupChatController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_chat_member
  before_action :require_manager, only: :update

  # GET /api/groups/:group_slug/chat -> { channels, can_create, can_manage, settings?, roles, people, message_max }
  def show
    @group.general_channel
    render json: chat_json
  end

  # PATCH /api/groups/:group_slug/chat { creator_roles: [], creator_user_ids: [] } (admins)
  def update
    @group.chat_creator_roles = ChatChannel::ROLES.keys & Array(params[:creator_roles]).map(&:to_s) if params.key?(:creator_roles)
    if params.key?(:creator_user_ids)
      @group.chat_creator_user_ids = @group.active_memberships.where(user_id: Array(params[:creator_user_ids]).compact_blank).pluck(:user_id).sort
    end
    @group.save!
    render json: chat_json
  rescue ActiveRecord::RecordInvalid
    render_errors(@group)
  end

  private

  def require_chat_member
    return if @group.member?(current_user)

    render json: { error: "Only members of this group can use its chat." }, status: :forbidden
  end

  def chat_json
    membership = @group.membership_for(current_user)
    channels = @group.chat_channels.ordered.select { |c| c.readable_by?(current_user, membership) }
    unread = ChatChannel.unread_counts(channels.reject(&:archived), current_user)
    manage = @group.manageable_by?(current_user)
    json = {
      group: { slug: @group.slug, title: @group.title,
               logo_url: (Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.logo, only_path: true) if @group.logo.attached?) },
      me: { id: current_user.id, username: current_user.username },
      channels: channels.map { |c| c.as_api_json(viewer: current_user, unread: unread[c.id] || 0) },
      can_create: @group.chat_creatable_by?(current_user), can_manage: manage,
      roles: ChatChannel::ROLES.map { |key, label| { key: key, label: label } },
      # Who can be put in a channel (and allowed to add channels)
      people: @group.members.includes(avatar_attachment: :blob).order(:name).map(&:as_person_json),
      message_max: ChatMessage::BODY_MAX,
    }
    json[:settings] = { creator_roles: @group.chat_creator_roles, creator_user_ids: @group.chat_creator_user_ids } if manage
    json
  end
end
