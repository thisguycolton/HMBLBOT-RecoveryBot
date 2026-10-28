# A member's chips (/recovery/chips) and the home group they're drawn for. Everything here is
# the member's own: nobody else, group admins included, sees their inventories, lists or chips.
class Api::RecoveryController < ApplicationController
  before_action :authenticate_user!

  # GET /api/recovery?today=YYYY-MM-DD -> their sobriety date, home group and its chip design,
  # the triangle chips they've earned, and whether today's inventory and list are written
  def show
    today = StepInventory.parse_day(params[:today]) || Date.current
    home = current_user.chip_home_group
    render json: {
      sobriety_date: current_user.sobriety_date&.iso8601,
      home_group: home && group_json(home),
      groups: current_user.groups.order("group_memberships.created_at").map { |g| group_json(g) },
      design: ChipDesign.for_group(home),
      triangles: Chips.summary(current_user),
      today: {
        inventory: current_user.step_inventories.exists?(on: today),
        gratitude: current_user.gratitude_lists.exists?(on: today),
      },
    }
  end

  # PATCH /api/recovery { home_group: slug } -> the chips' home group
  def update
    group = current_user.groups.find_by(slug: params[:home_group])
    return render(json: { error: "Pick one of your groups." }, status: :unprocessable_entity) unless group

    current_user.update!(chip_group: group)
    show
  end

  private

  def group_json(group)
    { slug: group.slug, title: group.title,
      logo_url: group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(group.logo, only_path: true) : nil }
  end
end
