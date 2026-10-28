# How a group's chips look (ChipDesign), in Group dashboard > Chips. Group admins only; members
# see their home group's design on their own Chips page (Api::RecoveryController).
class Api::GroupChipsController < ApplicationController
  include GroupScoped
  before_action :set_group
  before_action :require_manager

  # GET /api/groups/:slug/chips
  def show = render(json: design_json)

  # PUT /api/groups/:slug/chips { design } (or { reset: true } for the RecoveryBot design)
  def update
    design = ActiveModel::Type::Boolean.new.cast(params[:reset]) ? nil : ChipDesign.normalize(params[:design]).presence
    @group.update!(chip_design: design)
    render json: design_json
  end

  private

  def design_json
    { design: ChipDesign.for_group(@group), default: ChipDesign::DEFAULT, customized: @group.chip_design.present?,
      logo_url: @group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.logo, only_path: true) : nil }
  end
end
