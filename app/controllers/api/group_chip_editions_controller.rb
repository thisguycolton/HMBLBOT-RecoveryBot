# Special Editions (ChipEdition), in Group dashboard > Chips: limited chips the group makes for
# a year, a month, a week or a holiday. Saved as drafts until published; publishing tells the
# group's members. Once the first one is out its design and name are fixed. Group admins only.
class Api::GroupChipEditionsController < ApplicationController
  include GroupScoped
  before_action :set_group
  before_action :require_manager
  before_action :require_plan, only: %i[create publish duplicate]
  before_action :set_edition, only: %i[update destroy publish duplicate]

  # GET /api/groups/:slug/chip_editions
  def index
    editions = @group.chip_editions.ordered.to_a
    editions.each(&:award_everyone!)
    render json: { editions: editions.map(&:as_api_json), open: ChipEdition.open_to?(@group),
                   meetings: @group.meetings.ordered.map { |m| { id: m.id, name: m.name } } }
  end

  # POST /api/groups/:slug/chip_editions { edition }
  def create
    edition = @group.chip_editions.new(edition_params.merge(created_by: current_user))
    edition.design = ChipDesign.normalize(@group.chip_design) if edition.design.blank?
    save(edition, :created)
  end

  # PATCH /api/groups/:slug/chip_editions/:id { edition }
  def update
    @edition.assign_attributes(edition_params)
    save(@edition)
  end

  # POST /api/groups/:slug/chip_editions/:id/publish -> out, and the group's members hear of it
  def publish
    return render(json: { edition: @edition.as_api_json }) if @edition.published?

    @edition.update!(published_at: Time.current)
    what = @edition.kind == "milestone" ? "for milestones reached #{@edition.window_label}" : "for #{@edition.target_count} meetings, #{@edition.window_label}"
    Notification.deliver(@group.members.to_a, kind: "chip.edition_new", title: "#{@group.title} made a Special Edition chip: #{@edition.name}",
                                              body: "#{what.capitalize}#{" · only #{@edition.limit}" if @edition.limited?}", url: "/recovery")
    render json: { edition: @edition.as_api_json }
  end

  # POST /api/groups/:slug/chip_editions/:id/duplicate -> a new draft like it, for next time
  def duplicate
    copy = @group.chip_editions.new(@edition.attributes.slice(*%w[kind design window milestones meeting_ids target_count how_many limit numbered starts_on ends_on])
                                      .merge(name: "#{@edition.name} (copy)".first(40), created_by: current_user))
    save(copy, :created)
  end

  # DELETE /api/groups/:slug/chip_editions/:id -> a draft, or one nobody has yet
  def destroy
    return render(json: { error: "Chips are already out in this edition, so it stays. You can end it early instead." }, status: :unprocessable_entity) if @edition.locked?

    @edition.destroy!
    head :no_content
  end

  private

  def set_edition = @edition = @group.chip_editions.find(params[:id])

  # Special Editions will be part of a paid plan (ChipEdition.open_to?)
  def require_plan
    render json: { error: "Special Editions aren't part of this group's plan." }, status: :payment_required unless ChipEdition.open_to?(@group)
  end

  def save(edition, status = :ok)
    if edition.save
      render json: { edition: edition.as_api_json }, status: status
    else
      render json: { error: edition.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def edition_params
    p = params.require(:edition).permit(:name, :kind, :starts_on, :ends_on, :window, :target_count, :how_many, :limit, :numbered, milestones: [], meeting_ids: [])
    p[:meeting_ids] = Array(p[:meeting_ids]).map(&:to_i) & @group.meetings.pluck(:id) if p.key?(:meeting_ids)
    design = params.dig(:edition, :design)
    p[:design] = design.respond_to?(:to_unsafe_h) ? design.to_unsafe_h : design if design
    p
  end
end
