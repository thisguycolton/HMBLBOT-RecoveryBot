# Working the steps (/recovery/steps): the worksheets there are for each step (StepTool), and
# a member's own work on them (StepWork). Everything here is the member's own.
class Api::StepWorksController < ApplicationController
  before_action :authenticate_user!
  before_action :set_work, only: %i[show update destroy link unlink]

  # GET /api/step_works -> the steps, the worksheets for each, their work, and what needs
  # their attention (StepAttention)
  def index
    works = current_user.step_works.order(updated_at: :desc)
    render json: {
      steps: StepTool::STEPS.map { |n| { step: n, text: StepTool::STEP_NAMES[n - 1] } },
      tools: StepTool.all.map(&:as_api_json),
      works: works.map(&:as_api_json),
      attention: StepAttention.for(current_user),
      # Worksheets their sponsors suggested and their groups shared (only worksheets, no answers)
      suggestions: StepSuggestion.waiting.joins(:sponsorship).merge(Sponsorship.active.where(sponsee_id: current_user.id))
                                 .includes(sponsorship: :sponsor).order(created_at: :desc).map(&:as_api_json),
      group_tools: GroupStepTool.where(group: current_user.groups).includes(:group, :created_by).order(:step, :name).map { |t| t.as_api_json(current_user) },
      # Where they can share a worksheet: their sponsees, and groups they host or run
      sponsees: Sponsorship.active.where(sponsor_id: current_user.id).includes(:sponsee).map { |s| { id: s.id, name: s.sponsee.display_name } },
      publish_groups: current_user.groups.order(:title).select { |g| GroupStepTool.publishable_by?(g, current_user) }.map { |g| { slug: g.slug, title: g.title } },
    }
  end

  # POST /api/step_works { tool_key } | { copy_of: id } | { group_tool_id } -> started
  def create
    work = if params[:group_tool_id].present?
             t = GroupStepTool.where(group: current_user.groups).find(params[:group_tool_id])
             current_user.step_works.create!(step: t.step, tool_key: t.tool_key, name: t.name, definition: t.definition, answers: {},
                                             settings: { "from" => "From #{t.group.title}", "from_note" => t.summary })
           elsif params[:copy_of].present?
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

  # PATCH /api/step_works/:id { answers, name, status, settings, definition, remind_at,
  # remind_days, auto_send, send_text } -> saved. With auto_send on, `send_text` (the worksheet
  # as text, made on the page) goes to their sponsors, replacing what they haven't opened yet.
  # (`definition` is their customized worksheet: StepTool.clean keeps only what it understands)
  def update
    @work.answers = params[:answers].respond_to?(:to_unsafe_h) ? params[:answers].to_unsafe_h : {} if params.key?(:answers)
    @work.name = params[:name] if params.key?(:name)
    @work.settings = @work.settings.merge(params[:settings].to_unsafe_h.slice("higher_power")) if params[:settings].respond_to?(:to_unsafe_h)
    @work.definition = StepTool.clean(params[:definition]) if params[:definition].present?
    if params.key?(:status)
      @work.status = params[:status].to_s
      @work.done_at = @work.status == "done" ? (@work.done_at || Time.current) : nil
    end
    @work.remind_at = params[:remind_at] if params.key?(:remind_at)
    @work.remind_days = Array(params[:remind_days]) if params.key?(:remind_days)
    @work.auto_send = ActiveModel::Type::Boolean.new.cast(params[:auto_send]) if params.key?(:auto_send)
    @work.save!
    auto_send!(params[:send_text].to_s) if @work.auto_send && params[:send_text].present?
    render json: { work: @work.as_api_json(full: true) }
  rescue StepTool::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  def destroy
    @work.destroy!
    head :no_content
  end

  # POST /api/step_works/:id/link { password, new_link } -> turns on (or changes) its
  # password-protected link
  def link
    @work.share!(params[:password], new_link: ActiveModel::Type::Boolean.new.cast(params[:new_link]))
    render json: { work: @work.as_api_json(full: true) }
  rescue ArgumentError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # DELETE /api/step_works/:id/link -> the link stops working
  def unlink
    @work.stop_sharing!
    render json: { work: @work.as_api_json(full: true) }
  end

  # GET /api/step_works/pull?step=4&role=who -> names (or my part answers) from their work on
  # an earlier step
  def pull
    step = params[:step].to_i
    return render(json: { values: [] }) unless StepTool::STEPS.include?(step) && StepTool::ROLES.include?(params[:role])

    render json: { values: StepWork.pull(current_user, step: step, role: params[:role]) }
  end

  private

  # The worksheet sent to every sponsor as text, in place of the copy they haven't opened yet.
  # A sponsor is told once, when a new copy reaches them, not on every save.
  def auto_send!(text)
    title = "#{@work.step == 6 && @work.tool_key == 'drop-the-rock' ? 'Steps 6 and 7' : "Step #{@work.step}"}: #{@work.name}".first(200)
    sponsorships = Sponsorship.active.where(sponsee_id: current_user.id).includes(:sponsor).to_a
    sponsorships.each do |s|
      share = s.shares.where(kind: "step_work", title: title, seen_at: nil).first_or_initialize
      fresh = share.new_record?
      share.update!(on: Date.current, body: text.first(SponsorshipShare::BODY_MAX))
      next unless fresh

      Notification.deliver(s.sponsor, kind: "sponsorship.share", from: current_user,
                                      title: "#{current_user.display_name} sent you their step work", body: title, url: "/recovery/sponsorship/#{s.id}")
    end
    @work.update_column(:auto_sent_at, Time.current) if sponsorships.any?
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn("[auto send] #{@work.id}: #{e.message}")
  end

  def set_work
    @work = current_user.step_works.find_by(id: params[:id])
    render(json: { error: "That isn't one of yours." }, status: :not_found) unless @work
  end
end
