# Site Admin > Sobriety chips > Special Editions: RecoveryBot's own limited chips (ChipEdition
# without a group), made like a group's (Api::GroupChipEditionsController) with the same editor,
# limits and numbering. Any member who reaches a milestone in the window can claim a milestone
# edition, site admins give them on Give a chip (Admin Chips), and Meeting Maker editions count
# any meeting. Publishing doesn't notify everyone; members who qualify see the claim on Chips.
class Api::Admin::ChipEditionsController < Api::Admin::SuiteController
  before_action :set_edition, only: %i[update destroy publish duplicate]

  # GET /api/admin/chip_editions
  def index
    editions = ChipEdition.site.ordered.to_a
    editions.each(&:award_everyone!)
    render json: { editions: editions.map(&:as_api_json), open: true, meetings: [] }
  end

  # POST /api/admin/chip_editions { edition }
  def create
    edition = ChipEdition.new(edition_params.merge(created_by: current_user))
    edition.design = ChipDesign.normalize(ChipDesign.for_site) if edition.design.blank?
    save(edition, :created)
  end

  # PATCH /api/admin/chip_editions/:id { edition }
  def update
    @edition.assign_attributes(edition_params)
    save(@edition)
  end

  # POST /api/admin/chip_editions/:id/publish
  def publish
    @edition.update!(published_at: Time.current) unless @edition.published?
    render json: { edition: @edition.as_api_json }
  end

  # POST /api/admin/chip_editions/:id/duplicate -> a new draft like it
  def duplicate
    copy = ChipEdition.new(@edition.attributes.slice(*%w[kind design window milestones meeting_ids target_count how_many limit numbered starts_on ends_on])
                             .merge(name: "#{@edition.name} (copy)".first(40), created_by: current_user))
    save(copy, :created)
  end

  # DELETE /api/admin/chip_editions/:id -> a draft, or one nobody has yet
  def destroy
    return render(json: { error: "Chips are already out in this edition, so it stays. You can end it early instead." }, status: :unprocessable_entity) if @edition.locked?

    @edition.destroy!
    head :no_content
  end

  private

  def set_edition = @edition = ChipEdition.site.find(params[:id])

  def save(edition, status = :ok)
    if edition.save
      render json: { edition: edition.as_api_json }, status: status
    else
      render json: { error: edition.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def edition_params
    p = params.require(:edition).permit(:name, :kind, :starts_on, :ends_on, :window, :target_count, :how_many, :limit, :numbered, milestones: [])
    p[:meeting_ids] = [] # any meeting
    design = params.dig(:edition, :design)
    p[:design] = design.respond_to?(:to_unsafe_h) ? design.to_unsafe_h : design if design
    p
  end
end
