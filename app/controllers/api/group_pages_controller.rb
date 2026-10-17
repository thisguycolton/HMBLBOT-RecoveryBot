# A group's page (app/services/group_page.rb), and its HMBLBOT Editor
# (app/javascript/components/groups/page/GroupPageEditor.jsx). Everyone sees an active
# group's page, signed in or not; its admins edit it.
class Api::GroupPagesController < ApplicationController
  include GroupScoped
  include TakesPageImages

  skip_before_action :authenticate_user!, only: :show
  before_action :set_viewable_group, only: :show
  before_action :set_group, except: :show
  before_action :require_manager, only: %i[update images]

  # GET /api/groups/:group_slug/page
  def show
    render json: GroupPage.new(current_user).group_json(@group)
  end

  # PATCH /api/groups/:group_slug/page (multipart when a cover comes along)
  # page: layout, blocks (JSON string or array), cover, remove_cover; reset: back to the
  # default page
  def update
    attrs = params.require(:page)
    return render(json: { error: "The cover needs to be a JPEG, PNG, WebP or GIF under 10 MB." }, status: :unprocessable_entity) unless cover_ok?(attrs[:cover])

    if ActiveModel::Type::Boolean.new.cast(attrs[:reset])
      @group.page_blocks = nil
    else
      @group.page_layout = attrs[:layout] if attrs.key?(:layout)
      @group.page_blocks = page_blocks_param(attrs[:blocks]) if attrs.key?(:blocks)
    end
    @group.cover = attrs[:cover] if attrs[:cover].present?
    return render_errors(@group) unless @group.save

    @group.cover.purge_later if ActiveModel::Type::Boolean.new.cast(attrs[:remove_cover]) && attrs[:cover].blank?
    render json: GroupPage.new(current_user).group_json(@group.reload)
  end

  # POST /api/groups/:group_slug/page/images { file } -> { url }
  def images
    attach_page_image(@group.page_images)
  end

  # DELETE /api/groups/:group_slug/page/timeline/:note_id -> take a note off the group's
  # timeline (its author, or the group's admins); it stays on its author's own timeline
  def remove_note
    share = @group.timeline_note_shares.includes(:timeline_note).find_by!(timeline_note_id: params[:note_id])
    unless share.timeline_note.user_id == current_user.id || @group.manageable_by?(current_user)
      return render(json: { error: "Only its author or the group's admins can take it down." }, status: :forbidden)
    end

    share.destroy!
    head :no_content
  end
end
