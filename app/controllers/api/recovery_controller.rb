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
      streaks: catalog[:streaks],
      totals: catalog[:totals],
      favorites: current_user.chip_favorites,
      favorites_max: Chips::FAVORITES,
      show_on_profile: current_user.show_chips_on_profile,
      profile_path: (current_user.profile_path if User.profiles_open_to?(current_user)),
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

  private

  def today = StepInventory.parse_day(params[:today]) || Date.current
end
