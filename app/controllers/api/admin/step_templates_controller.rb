# Site Admin > Step worksheets: the worksheets every member can start on the Steps page
# (StepTemplate). Edits save as a draft only admins see; publishing makes the draft the next
# version, the one new worksheets start from. Lists show how many people started each one, never
# anything they wrote.
class Api::Admin::StepTemplatesController < Api::Admin::SuiteController
  before_action :set_template, only: %i[show update publish restore destroy]

  # GET /api/admin/step_templates
  def index
    started = StepWork.where.not(tool_key: nil).group(:tool_key).count
    render json: {
      templates: StepTemplate.ordered.map { |t| t.as_admin_json(started: started[t.key] || 0) },
      steps: StepTool::STEPS.map { |n| { step: n, text: StepTool::STEP_NAMES[n - 1] } },
    }
  end

  def show = render(json: { template: @template.as_editor_json })

  # POST /api/admin/step_templates { step, name } | { file } (JSON or YAML) -> a new draft
  def create
    template = params[:file].present? ? StepTemplate.from_file(params[:file].to_s, by: current_user) : StepTemplate.build(by: current_user, step: params[:step], name: params[:name])
    template.save ? render(json: { template: template.as_editor_json }, status: :created) : invalid(template)
  rescue StepTool::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # PATCH /api/admin/step_templates/:id { template: { name, summary, credit, step, steps,
  # default, hidden, draft } }
  def update
    raw = params.require(:template)
    attrs = raw.permit(:name, :summary, :credit, :step, :default, :hidden, steps: []).to_h
    attrs[:draft] = raw[:draft].to_unsafe_h if raw[:draft].respond_to?(:to_unsafe_h)
    @template.assign_attributes(attrs)
    @template.save ? render(json: { template: @template.as_editor_json }) : invalid(@template)
  rescue StepTool::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/admin/step_templates/:id/publish -> the draft is the new version members start from
  def publish
    @template.publish!(current_user)
    render json: { template: @template.as_editor_json }
  end

  # POST /api/admin/step_templates/:id/restore { number } -> a draft from that version
  def restore
    @template.restore!(params[:number].to_i)
    render json: { template: @template.as_editor_json }
  end

  # DELETE: only a draft never published (a published one can be hidden from members)
  def destroy
    return render(json: { error: "It's been published, so hide it from members instead." }, status: :unprocessable_entity) if @template.published?

    @template.destroy!
    head :no_content
  end

  private

  def set_template = @template = StepTemplate.find(params[:id])
  def invalid(t) = render(json: { error: t.errors.full_messages.to_sentence, errors: t.errors.full_messages }, status: :unprocessable_entity)
end
