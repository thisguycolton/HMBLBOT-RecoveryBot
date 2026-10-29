# Site Admin > Chip design: how RecoveryBot's own sobriety chips look, the round chips members
# earn on their own (ChipDesign.for_site): their words, emblem or a chip template's art, colors
# and finishes, and each milestone's own look. Chips already earned keep the look they were
# earned in (ChipDesignVersion "Site").
class Api::Admin::ChipDesignsController < Api::Admin::SuiteController
  # GET /api/admin/chip_design
  def show = render(json: design_json)

  # PUT /api/admin/chip_design { design } (or { reset: true } for the plain default)
  def update
    ChipDesign.save_site!(ActiveModel::Type::Boolean.new.cast(params[:reset]) ? nil : params[:design])
    render json: design_json
  end

  # POST /api/admin/chip_design/relief { svg } -> { relief }: an uploaded SVG as a raised logo's
  # outlines (ChipRelief); nothing is saved until the design is
  def relief
    render json: { relief: ChipRelief.from_svg(params[:svg].to_s) }
  rescue ChipRelief::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def design_json
    design = ChipDesign.for_site
    { design: design, default: ChipDesign::DEFAULT, customized: design["round"] != ChipDesign::DEFAULT["round"],
      templates: ChipTemplate.usable_by(nil).includes(:versions).map(&:as_api_json) }
  end
end
