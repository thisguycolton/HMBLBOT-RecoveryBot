# The default group page (app/models/group_page_template.rb), in the HMBLBOT Editor at
# /groups/default-page/edit. Site admins edit it.
class Api::GroupPageTemplatesController < ApplicationController
  include GroupScoped
  include TakesPageImages

  before_action :require_site_admin, only: %i[update images]

  # GET /api/group_page_template
  def show
    return render(json: { error: "Groups isn't open yet." }, status: :forbidden) unless Group.feature_open_to?(current_user)

    render json: GroupPage.new(current_user).template_json
  end

  # PATCH /api/group_page_template { page: { layout, blocks, cover, remove_cover } }
  def update
    attrs = params.require(:page)
    return render(json: { error: "The cover needs to be a JPEG, PNG, WebP or GIF under 10 MB." }, status: :unprocessable_entity) unless cover_ok?(attrs[:cover])

    template = GroupPageTemplate.current
    template.layout = attrs[:layout] if attrs.key?(:layout)
    template.blocks = page_blocks_param(attrs[:blocks]) if attrs.key?(:blocks)
    template.cover = attrs[:cover] if attrs[:cover].present?
    template.updated_by = current_user
    return render_errors(template) unless template.save

    template.cover.purge_later if ActiveModel::Type::Boolean.new.cast(attrs[:remove_cover]) && attrs[:cover].blank?
    render json: GroupPage.new(current_user).template_json
  end

  # POST /api/group_page_template/images { file } -> { url }
  def images
    attach_page_image(GroupPageTemplate.current.images)
  end

  private

  def require_site_admin
    render json: { error: "Only site admins can change the default page." }, status: :forbidden unless current_user.suite_admin?
  end
end
