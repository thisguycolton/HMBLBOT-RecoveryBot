# How a group's chips look (ChipDesign), in Group dashboard > Chips: the round chips its hosts
# give (ChipAward), its Meeting Maker chips (the group's default, and each meeting's own), the
# chip templates it can put on them (ChipTemplate: the site's, and art the group imported), and
# its Special Editions (Api::ChipEditionsController). Group admins only.
#
# Minted chips never change: a chip given keeps the design it was given in, and when a
# meeting's Meeting Maker chips change, how they looked until then is kept (ChipDesignVersion),
# so chips already earned stay that way.
class Api::GroupChipsController < ApplicationController
  include GroupScoped
  before_action :set_group
  before_action :require_manager

  # GET /api/groups/:slug/chips
  def show = render(json: design_json)

  # PUT /api/groups/:slug/chips { design } (or { reset: true } for the RecoveryBot design)
  def update
    design = ActiveModel::Type::Boolean.new.cast(params[:reset]) ? nil : ChipDesign.pin(params[:design]).presence
    keeping_meetings { @group.update!(chip_design: design) }
    render json: design_json
  end

  # POST /api/groups/:slug/chips/relief { svg } -> { relief }: an uploaded SVG turned into the
  # outlines for a raised logo (ChipRelief). Nothing is saved until the design is.
  def relief
    render json: { relief: ChipRelief.from_svg(params[:svg].to_s) }
  rescue ChipRelief::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # PUT /api/groups/:slug/chips/meetings/:meeting_id { design: { meeting } } (or { reset: true }
  # for the group's default)
  def meeting
    meeting = @group.meetings.find(params[:meeting_id])
    design = ActiveModel::Type::Boolean.new.cast(params[:reset]) ? nil : ChipDesign.pin(params[:design]).slice("meeting").presence
    keeping_meetings([meeting]) { meeting.update!(chip_design: design) }
    render json: design_json
  end

  # POST /api/groups/:slug/chips/templates { svg, title } -> the group's own art, ready to use
  # (only this group sees it)
  def create_template
    template = ChipTemplate.import(params[:svg].to_s, title: params[:title].presence || "Our art", group: @group, created_by: current_user,
                                                      fits: "both", source: "Imported by #{@group.title}")
    template.save!
    template.publish!
    render json: template.as_api_json, status: :created
  rescue ChipArt::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # DELETE /api/groups/:slug/chips/templates/:id -> off the group's list (chips in it keep it)
  def destroy_template
    @group.chip_templates.find(params[:id]).update!(status: "retired")
    head :no_content
  end

  private

  # Saves how `meetings`' chips look before and after the change, when it changes them
  def keeping_meetings(meetings = @group.meetings.to_a)
    before = meetings.to_h { |m| [m.id, ChipDesign.for_meeting(m)] }
    yield
    meetings.each do |m|
      after = ChipDesign.for_meeting(m.reload)
      ChipDesignVersion.record(m, after, before: before[m.id]) if after != before[m.id]
    end
  end

  def design_json
    { design: ChipDesign.for_group(@group), default: ChipDesign::DEFAULT, customized: @group.chip_design.present?,
      meeting_customized: @group.chip_design&.key?("meeting") || false,
      logo_url: @group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.logo, only_path: true) : nil,
      templates: ChipTemplate.usable_by(@group).includes(:versions).map(&:as_api_json),
      meetings: @group.meetings.ordered.map do |m|
        { id: m.id, name: m.name, schedule_label: m.schedule_label, design: ChipDesign.for_meeting(m),
          customized: ChipDesign.normalize(m.chip_design)["meeting"].present? }
      end }
  end
end
