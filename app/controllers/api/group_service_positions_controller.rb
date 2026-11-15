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
                   can_edit: keeper?, can_set_roles: admin, members: keeper? ? member_choices : [] }
  end

  # POST /api/groups/:group_slug/service_positions
  def create
    position = @group.service_positions.new(position_params)
    position.save ? render(json: position.as_api_json(today: @group.zone.today), status: :created) : render_errors(position)
  end

  # PATCH /api/groups/:group_slug/service_positions/:id
  def update
    was = @position.grants
    return render_errors(@position) unless @position.update(position_params)

    OfficeRoles.apply(@group, [@position.current_term(@group.zone.today)&.user], [was, @position.grants]) if @position.grants != was
    render json: @position.as_api_json(today: @group.zone.today)
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
    attrs = params.require(:service_position).permit(:title, :description, :term_months, :sobriety_months, :archived, :on_agenda, :agenda_heading, :agenda_lines, :grants)
    # Which role an office gives is the admins' to choose: a record keeper can't hand out roles
    @group.manageable_by?(current_user) ? attrs : attrs.except(:grants)
  end

  # For an admin: the person holding this office now doesn't have the role it gives (they held it
  # before offices gave roles, or it was taken away by hand), so the office can offer it
  def access_gap(position, today)
    user = position.current_term(today)&.user
    role = OfficeRoles::ROLES[position.grants]
    return unless user && role

    membership = @group.membership_for(user)
    return unless membership&.active? && !membership.admin? && !membership.public_send(position.grants)

    { membership_id: membership.id, flag: position.grants, role: role[:label], covers: role[:covers], name: user.display_name }
  end

  def member_choices
    @group.members.map { |u| { id: u.id, name: u.display_name } }.sort_by { |m| m[:name].downcase }
  end
end
