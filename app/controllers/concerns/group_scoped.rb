# Shared by the Groups API controllers: JSON errors, finding the group from :group_slug or
# :slug, and who may see or run it (see Group#visible_to? and #manageable_by?).
module GroupScoped
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_user!
    rescue_from ActiveRecord::RecordNotFound, with: -> { render json: { error: "Not found." }, status: :not_found }
  end

  private

  def set_group
    @group = Group.find_by!(slug: params[:group_slug] || params[:slug])
    render json: { error: "Not found." }, status: :not_found unless @group.visible_to?(current_user)
  end

  # The group's page and asking to join: any active group (Group#page_visible_to?)
  def set_viewable_group
    @group = Group.find_by!(slug: params[:group_slug] || params[:slug])
    render json: { error: "Not found." }, status: :not_found unless @group.page_visible_to?(current_user)
  end

  def require_manager
    return if @group.manageable_by?(current_user)

    render json: { error: "Only this group's admins can do that." }, status: :forbidden
  end

  def keeper? = @group.records_editable_by?(current_user)

  def require_keeper
    return if keeper?

    render json: { error: "Only this group's record keepers can do that." }, status: :forbidden
  end

  def require_member
    return if current_user.suite_admin? || @group.member?(current_user)

    render json: { error: "Only members of this group can see that." }, status: :forbidden
  end

  # Premium tools (see Premium): a group without it still reads what it wrote, but can't add or
  # change it. The page shows the upgrade note on premium_required.
  def require_premium
    return if @group.premium?

    render json: { error: "This is a premium tool. #{@group.title} can keep reading what's here; a group admin can turn premium on in Plan & contributions.", premium_required: true }, status: :payment_required
  end

  def render_errors(record)
    render json: { error: record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end
end
