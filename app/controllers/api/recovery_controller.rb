# A member's chips (/recovery): every one they've earned or been given (Chips.catalog), the next
# in each series, their streaks, and their choices (which chip shows on top when two mark the
# same milestone, favorites for their profile). Everything here is the member's own.
class Api::RecoveryController < ApplicationController
  before_action :authenticate_user!

  # GET /api/recovery?today=YYYY-MM-DD
  def show
    catalog = Chips.catalog(current_user, today)
    render json: {
      sobriety_date: current_user.sobriety_date&.iso8601,
      design: ChipDesign::DEFAULT,
      chips: Chips.ordered(catalog[:chips], current_user.chip_tops),
      upcoming: catalog[:upcoming],
      # Special Editions they can claim: a milestone they reached during one of their groups' runs
      available: ChipEdition.available_for(current_user, today),
      streaks: catalog[:streaks],
      totals: catalog[:totals],
      favorites: current_user.chip_favorites,
      favorites_max: Chips::FAVORITES,
      show_on_profile: current_user.show_chips_on_profile,
      profile_path: (current_user.profile_path if User.profiles_open_to?(current_user)),
      # Sharing a chip to their timeline: the groups they can share it to too, and the chips they already shared
      share_groups: current_user.groups.order(:title).map { |g| { slug: g.slug, title: g.title } },
      shared: current_user.timeline_notes.where.not(chip_id: nil).pluck(:chip_id).uniq,
      can_give: current_user.groups.any? { |g| g.can_host?(current_user) },
      today: {
        inventory: current_user.step_inventories.exists?(on: today),
        gratitude: current_user.gratitude_lists.exists?(on: today),
      },
    }
  end

  # PATCH /api/recovery { top: { slot, id } } | { favorites: [ids] } | { show_on_profile }
  def update
    ids = Chips.catalog(current_user, today)[:chips].to_h { |c| [c[:id], c[:slot]] }
    if params[:top].present?
      slot, id = params[:top].values_at(:slot, :id).map(&:to_s)
      return render(json: { error: "That isn't one of your chips." }, status: :unprocessable_entity) unless ids[id] == slot

      current_user.chip_tops = current_user.chip_tops.merge(slot => id)
    end
    current_user.chip_favorites = Array(params[:favorites]).map(&:to_s).select { |id| ids.key?(id) }.uniq.first(Chips::FAVORITES) if params.key?(:favorites)
    current_user.show_chips_on_profile = ActiveModel::Type::Boolean.new.cast(params[:show_on_profile]) if params.key?(:show_on_profile)
    current_user.save!
    show
  end

  # POST /api/recovery/claim { edition_id, slot } -> a Special Edition for a milestone they
  # reached in its window, numbered (they can claim it any time after)
  def claim
    edition = ChipEdition.published.where(group_id: current_user.groups.select(:id)).find_by(id: params[:edition_id])
    return render(json: { error: "That edition isn't one you can claim." }, status: :not_found) unless edition

    chip = edition.claim!(current_user, params[:slot].to_s, today)
    current_user.update!(chip_tops: current_user.chip_tops.merge(chip.slot => "edition:#{chip.id}")) # the new one goes on top
    render json: { chip: chip.as_chip_json }, status: :created
  rescue ChipEdition::NotYours
    render json: { error: "That milestone isn't one this edition is for." }, status: :unprocessable_entity
  rescue ChipEdition::SoldOut
    render json: { error: "They're all claimed. Every one of this edition is out." }, status: :unprocessable_entity
  end

  private

  def today = StepInventory.parse_day(params[:today]) || Date.current
end
