# Site Admin > Chip templates: the art every group can put on its chips (ChipTemplate). Import
# an SVG, set its layers and paint it in the chip art editor, give it palettes and default
# words, then publish: each publish is a new version, so chips already out never change. Groups'
# own imports are listed too, and can be hidden.
class Api::Admin::ChipTemplatesController < Api::Admin::SuiteController
  before_action :set_template, only: %i[show update publish destroy]

  # GET /api/admin/chip_templates -> site templates, groups' own, and the default design
  def index
    render json: {
      templates: ChipTemplate.site.where.not(status: "retired").ordered.includes(:versions).map(&:as_api_json),
      group_templates: ChipTemplate.where.not(group_id: nil).where.not(status: "retired").includes(:group, :versions).order(updated_at: :desc).map(&:as_api_json),
      default: ChipDesign::DEFAULT, metals: ChipDesign::METALS,
    }
  end

  def show = render(json: @template.as_editor_json)

  # POST /api/admin/chip_templates { svg, title } -> a draft from the SVG's layers
  def create
    template = ChipTemplate.import(params[:svg].to_s, title: params[:title].presence || "New template", created_by: current_user,
                                                      position: (ChipTemplate.site.maximum(:position) || 0) + 1)
    template.save ? render(json: template.as_editor_json, status: :created) : render_errors(template)
  rescue ChipArt::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # PATCH /api/admin/chip_templates/:id { template: { title, fits, source, license, position,
  # hidden, art, palettes, defaults } } -> the draft (publish to put it on chips)
  def update
    @template.assign_attributes(template_params)
    @template.save ? render(json: @template.as_editor_json) : render_errors(@template)
  end

  # POST /api/admin/chip_templates/:id/publish -> its next version, for groups to use
  def publish
    @template.publish!
    render json: @template.as_editor_json
  rescue ActiveRecord::RecordInvalid
    render_errors(@template)
  end

  # DELETE: a draft never published goes; a published one is retired (chips keep it)
  def destroy
    @template.versions.any? ? @template.update!(status: "retired") : @template.destroy!
    head :no_content
  end

  private

  def set_template = @template = ChipTemplate.find(params[:id])

  def template_params
    raw = params.require(:template)
    out = raw.permit(:title, :fits, :source, :license, :position, :hidden).to_h
    %w[art palettes defaults].each { |k| out[k] = raw[k].respond_to?(:to_unsafe_h) ? raw[k].to_unsafe_h : raw[k] if raw.key?(k) }
    out
  end
end
