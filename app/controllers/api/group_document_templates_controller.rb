# The letterheads for a group's document folders (GroupDocumentTemplate). Members read them
# (their documents show them); record keepers change them.
class Api::GroupDocumentTemplatesController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_premium, only: :update
  before_action :require_member
  before_action :require_keeper, only: :update

  # GET /api/groups/:group_slug/document_templates -> one per folder, saved or not
  def index
    render json: { templates: GroupDocument::KINDS.map { |k| GroupDocumentTemplate.for(@group, k).as_api_json },
                   has_group_logo: @group.logo.attached?, can_edit: keeper? }
  end

  # PATCH /api/groups/:group_slug/document_templates/:id (the folder's kind; multipart for a seal)
  def update
    template = GroupDocumentTemplate.for(@group, params[:id])
    attrs = params.require(:template).permit(:mark, :header_text, :subheader_text, :footer_text, :align, :seal)
    template.seal.purge_later if ActiveModel::Type::Boolean.new.cast(params[:template][:remove_seal]) && attrs[:seal].blank?
    template.assign_attributes(attrs)
    template.save ? render(json: template.as_api_json) : render_errors(template)
  end
end
