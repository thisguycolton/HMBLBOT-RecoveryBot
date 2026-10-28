# How a group's chips look (ChipDesign), in Group dashboard > Chips: the round chips its hosts
# give (ChipAward), and each meeting's Meeting Maker chips. Group admins only.
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

  # POST /api/groups/:slug/chips/relief { svg } -> { relief }: an uploaded SVG turned into the
  # outlines for a raised logo (ChipRelief). Nothing is saved until the design is.
  def relief
    render json: { relief: ChipRelief.from_svg(params[:svg].to_s) }
  rescue ChipRelief::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # PUT /api/groups/:slug/chips/meetings/:meeting_id { design: { triangle } } (or { reset: true })
  def meeting
    meeting = @group.meetings.find(params[:meeting_id])
    design = ActiveModel::Type::Boolean.new.cast(params[:reset]) ? nil : ChipDesign.normalize(params[:design]).slice("triangle").presence
    meeting.update!(chip_design: design)
    render json: design_json
  end

  private

  def design_json
    { design: ChipDesign.for_group(@group), default: ChipDesign::DEFAULT, customized: @group.chip_design.present?,
      logo_url: @group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.logo, only_path: true) : nil,
      meetings: @group.meetings.ordered.map do |m|
        { id: m.id, name: m.name, schedule_label: m.schedule_label, design: ChipDesign.for_meeting(m), default_sides: ChipDesign.meeting_sides(m), customized: m.chip_design.present? }
      end }
  end
end
