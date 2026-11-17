# A group's offices (service positions) and who holds them (app/models/service_position.rb), in
# Group conscience > Officials and Manage > Offices. Members read them; record keepers change them;
# admins choose what each office lets its holder do (OfficeRoles: offices are where roles come
# from). Opening the list also sends any term reminders that are due.
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
    json = { positions: @group.service_positions.includes(terms: :service_position).ordered.map { |p| p.as_api_json(today: today) },
             can_edit: keeper?, can_set_roles: admin, members: keeper? ? member_choices : [] }
    json.merge!(admins: admin_names, hand_grants: hand_grants, slots: weekly_slots) if admin
    render json: json
  end

  # POST /api/groups/:group_slug/service_positions
  def create
    position = @group.service_positions.new(position_params)
    # A host coordinator office named for a time ("9AM Host Coordinator") starts with that time's meetings
    if position.grants == "can_schedule_hosts" && !params[:service_position].key?(:host_meeting_ids)
      position.host_meeting_ids = OfficeRoles.slot_meeting_ids(@group, position.title) || []
    end
    return render_errors(position) unless position.save

    hand_over(position) if params[:from_membership_id].present? && @group.manageable_by?(current_user)
    render json: position.reload.as_api_json(today: @group.zone.today), status: :created
  end

  # PATCH /api/groups/:group_slug/service_positions/:id
  def update
    was = @position.grants
    slots_were = @position.host_meeting_ids
    return render_errors(@position) unless @position.update(position_params)

    if @position.grants != was || @position.host_meeting_ids != slots_were || @position.saved_change_to_archived?
      OfficeRoles.apply(@group, [@position.current_term(@group.zone.today)&.user], [was, @position.grants])
    end
    render json: @position.as_api_json(today: @group.zone.today)
  end

  # DELETE /api/groups/:group_slug/service_positions/:id (with its history)
  def destroy
    holder = @position.current_term(@group.zone.today)&.user
    @position.destroy!
    OfficeRoles.apply(@group, [holder], [@position.grants])
    head :no_content
  end

  private

  def set_position
    @position = @group.service_positions.find(params[:id])
  end

  def position_params
    attrs = params.require(:service_position).permit(:title, :description, :term_months, :sobriety_months, :archived, :on_agenda, :agenda_heading, :agenda_lines, :grants, host_meeting_ids: [])
    # What an office lets its holder do is the admins' to choose: a record keeper can't hand out roles
    return attrs.except(:grants, :host_meeting_ids) unless @group.manageable_by?(current_user)

    attrs[:host_meeting_ids] = @group.meetings.weekly.where(id: attrs[:host_meeting_ids].compact_blank).ids.sort if attrs.key?(:host_meeting_ids)
    attrs
  end

  # "Make it an office" (Manage > Offices, a role given by hand before offices gave roles): the
  # person who had it holds the new office from today, so the role now comes from it. A host
  # coordinator's time slots move to the office.
  def hand_over(position)
    membership = @group.memberships.active.find_by(id: params[:from_membership_id])
    return unless membership

    if position.grants == "can_schedule_hosts" && params[:service_position][:host_meeting_ids].nil?
      position.update!(host_meeting_ids: membership.host_slots_only ? membership.host_meeting_ids : [])
    end
    position.terms.create!(user: membership.user, name: membership.user.display_name, starts_on: @group.zone.today)
    OfficeRoles.apply(@group, [membership.user], [position.grants])
  end

  # Admins can do everything, so Manage > Offices shows them as one more office
  def admin_names
    @group.admins.map(&:display_name).sort_by(&:downcase)
  end

  # Roles given by hand before offices gave them (no office behind them): they keep working, and
  # Manage > Offices offers to turn each into an office
  def hand_grants
    @group.memberships.active.where.not(role: "admin").includes(:user).flat_map do |m|
      OfficeRoles::ROLES.keys.select { |role| m[role] && !m.office_roles.include?(role) }.map do |role|
        { membership_id: m.id, name: m.user.display_name, grants: role,
          host_meeting_ids: role == "can_schedule_hosts" && m.host_slots_only ? m.host_meeting_ids : [] }
      end
    end.sort_by { |g| [g[:name].downcase, g[:grants]] }
  end

  # The weekly meetings a host coordinator office can cover
  def weekly_slots
    @group.meetings.weekly.ordered.map { |m| { id: m.id, name: m.name, day_of_week: m.day_of_week, start_minute: m.start_minute, end_minute: m.end_minute } }
  end

  def member_choices
    @group.members.map { |u| { id: u.id, name: u.display_name } }.sort_by { |m| m[:name].downcase }
  end
end
