# What the 10th step inventories and gratitude lists APIs share. Each is the member's own,
# one a day, found by its date: GET index (newest first, a page at a time with ?before=),
# GET/PUT/DELETE /:on. Saving answers which triangle chip it just earned, if any (Chips).
module RecoveryEntries
  extend ActiveSupport::Concern
  PAGE = 30

  included do
    before_action :authenticate_user!
    before_action :set_day, only: %i[show update destroy]
  end

  def index
    scope = entries.order(on: :desc)
    before = entry_class.parse_day(params[:before])
    scope = scope.where(on: ...before) if before
    page = scope.limit(PAGE + 1).to_a
    render json: { entries: page.first(PAGE).map(&:as_api_json), more: page.size > PAGE, total: entries.count }
  end

  def show
    entry = entries.find_by(on: @day)
    render json: { entry: entry&.as_api_json }
  end

  # PUT /:on -> saved (or, left empty, taken away), with the chip it earned
  def update
    before = entries.count
    entry = entries.find_or_initialize_by(on: @day)
    entry.assign_attributes(entry_params)
    entry.validate
    if entry.errors.empty? && entry.blank_entry?
      entry.destroy if entry.persisted?
      return render(json: { entry: nil, total: entries.count })
    end
    return render(json: { error: entry.errors.full_messages.to_sentence }, status: :unprocessable_entity) unless entry.save

    after = entries.count
    render json: { entry: entry.as_api_json, total: after, new_chip: Chips.just_earned(before, after)&.then { |n| { kind: chip_kind, count: n } } }
  end

  def destroy
    entries.where(on: @day).destroy_all
    head :no_content
  end

  private

  def set_day
    @day = entry_class.parse_day(params[:on])
    render json: { error: "That isn't a date." }, status: :not_found unless @day
  end
end
