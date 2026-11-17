# Site Admin > HostDeck scripts: the meeting scripts every group's host coordinators can start
# from in Set up HostDeck (HostScriptTemplate). Groups get a copy in their documents, so changes
# here only reach groups that copy it from now on.
class Api::Admin::HostScriptTemplatesController < Api::Admin::SuiteController
  before_action :set_template, only: %i[show update destroy reset]

  # GET /api/admin/host_script_templates
  def index
    render json: { templates: HostScriptTemplate.ordered.includes(:updated_by).map(&:as_admin_json) }
  end

  def show = render(json: { template: @template.as_editor_json })

  # POST /api/admin/host_script_templates { template: { name, description, body } } | { copy_of: id }
  def create
    template = if params[:copy_of].present?
                 source = HostScriptTemplate.find(params[:copy_of])
                 HostScriptTemplate.new(name: "Copy of #{source.name}".first(120), description: source.description, body: source.body, hidden: true)
               else
                 HostScriptTemplate.new(template_params.reverse_merge(hidden: true))
               end
    template.updated_by = current_user
    template.save ? render(json: { template: template.as_editor_json }, status: :created) : render_errors(template)
  end

  # PATCH /api/admin/host_script_templates/:id { template: { name, description, body, hidden, position } }
  def update
    @template.assign_attributes(template_params.merge(updated_by: current_user))
    @template.save ? render(json: { template: @template.as_editor_json }) : render_errors(@template)
  end

  # POST /api/admin/host_script_templates/:id/reset: the built-in script back as it came
  def reset
    return render(json: { error: "Only the built-in script can be put back." }, status: :unprocessable_entity) unless @template.built_in?

    @template.reset!(current_user)
    render json: { template: @template.as_editor_json }
  end

  # DELETE: groups that copied it keep their copies. The built-in one can be hidden, not deleted.
  def destroy
    return render(json: { error: "The built-in script can't be deleted. Hide it from groups instead." }, status: :unprocessable_entity) if @template.built_in?

    @template.destroy!
    head :no_content
  end

  private

  def set_template
    @template = HostScriptTemplate.find(params[:id])
  end

  def template_params
    params.require(:template).permit(:name, :description, :body, :hidden, :position)
  end
end
