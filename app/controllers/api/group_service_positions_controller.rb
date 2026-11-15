# A group's service positions and who holds them (app/models/service_position.rb). Members read
# them; record keepers change them. Opening the list also sends any term reminders that are due.
class Api::GroupServicePositionsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :require_keeper, only: %i[create update destroy]
  before_action :set_position, only: %i[update destroy]

  # GET /api/groups/:group_slug/service_positions
  def index
    ServiceRotation.remind_group!(@group)
    today = @group.zone.today
    admin = @group.manageable_by?(current_user)
    render json: { positions: @group.service_positions.includes(terms: :service_position).ordered.map { |p| p.as_api_json(today: today).tap { |j| j[:access] = access_gap(p, today) if admin } },
                   can_edit: keeper?, members: keeper? ? member_choices : [] }
  end

  # POST /api/groups/:group_slug/service_positions
  def create
    position = @group.service_positions.new(position_params)
    position.save ? render(json: position.as_api_json(today: @group.zone.today), status: :created) : render_errors(position)
  end

  # PATCH /api/groups/:group_slug/service_positions/:id
  def update
    @position.update(position_params) ? render(json: @position.as_api_json(today: @group.zone.today)) : render_errors(@position)
  end

  # DELETE /api/groups/:group_slug/service_positions/:id (with its history)
  def destroy
    @position.destroy!
    head :no_content
  end

  private

  def set_position
    @position = @group.service_positions.find(params[:id])
  end

  def position_params
    params.require(:service_position).permit(:title, :description, :term_months, :sobriety_months, :archived)
  end

  # Offices whose work needs a permission on the site, by what they're called
  ACCESS = [
    [/secretar|record|scribe|minutes/i, :can_keep_records, "record keeper", "the agenda, the minutes and the documents"],
    [/treasur/i, :can_keep_treasury, "treasurer", "the treasurer's reports"],
    [/host coord|coordinator/i, :can_schedule_hosts, "host coordinator", "the host schedule"],
  ].freeze

  # For an admin: the person holding this office now can't do its work on the site yet (the
  # elected secretary isn't a record keeper, say), so the office can offer to fix that
  def access_gap(position, today)
    user = position.current_term(today)&.user
    rule = ACCESS.find { |re, *| position.title.match?(re) }
    return unless user && rule

    membership = @group.membership_for(user)
    return unless membership&.active? && !membership.admin? && !membership.public_send(rule[1])

    { membership_id: membership.id, flag: rule[1], role: rule[2], covers: rule[3], name: user.display_name }
  end

  def member_choices
    @group.members.map { |u| { id: u.id, name: u.display_name } }.sort_by { |m| m[:name].downcase }
  end
end
