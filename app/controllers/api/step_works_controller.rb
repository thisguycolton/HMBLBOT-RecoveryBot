# Working the steps (/recovery/steps): the worksheets there are for each step (StepTool), and
# a member's own work on them (StepWork). Everything here is the member's own.
class Api::StepWorksController < ApplicationController
  before_action :authenticate_user!
  before_action :set_work, only: %i[show update destroy]

  # GET /api/step_works -> the steps, the worksheets for each, their work, and what needs
  # their attention (StepAttention)
  def index
    works = current_user.step_works.order(updated_at: :desc)
    render json: {
      steps: StepTool::STEPS.map { |n| { step: n, text: StepTool::STEP_NAMES[n - 1] } },
      tools: StepTool.all.map(&:as_api_json),
      works: works.map(&:as_api_json),
      attention: StepAttention.for(current_user),
    }
  end

  # POST /api/step_works { tool_key } | { copy_of: id } -> started
  def create
    work = if params[:copy_of].present?
             source = current_user.step_works.find(params[:copy_of])
             current_user.step_works.create!(step: source.step, tool_key: source.tool_key, name: "#{source.name} (new)".first(200),
                                             definition: source.definition, settings: source.settings, answers: {})
           else
             tool = StepTool.find(params[:tool_key].to_s)
             return render(json: { error: "That worksheet isn't here." }, status: :not_found) unless tool

             StepWork.start!(current_user, tool)
           end
    render json: { work: work.as_api_json(full: true) }, status: :created
  end

  def show
    render json: { work: @work.as_api_json(full: true) }
  end

  # PATCH /api/step_works/:id { answers, name, status, settings, definition } -> saved
  # (`definition` is their customized worksheet: StepTool.clean keeps only what it understands)
  def update
    @work.answers = params[:answers].respond_to?(:to_unsafe_h) ? params[:answers].to_unsafe_h : {} if params.key?(:answers)
    @work.name = params[:name] if params.key?(:name)
    @work.settings = params[:settings].to_unsafe_h if params[:settings].respond_to?(:to_unsafe_h)
    @work.definition = StepTool.clean(params[:definition]) if params[:definition].present?
    if params.key?(:status)
      @work.status = params[:status].to_s
      @work.done_at = @work.status == "done" ? (@work.done_at || Time.current) : nil
    end
    @work.save!
    render json: { work: @work.as_api_json(full: true) }
  rescue StepTool::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def destroy
    @work.destroy!
    head :no_content
  end

  # GET /api/step_works/pull?step=4&role=who -> names (or my part answers) from their work on
  # an earlier step
  def pull
    step = params[:step].to_i
    return render(json: { values: [] }) unless StepTool::STEPS.include?(step) && StepTool::ROLES.include?(params[:role])

    render json: { values: StepWork.pull(current_user, step: step, role: params[:role]) }
  end

  private

  def set_work
    @work = current_user.step_works.find_by(id: params[:id])
    render(json: { error: "That isn't one of yours." }, status: :not_found) unless @work
  end
end
