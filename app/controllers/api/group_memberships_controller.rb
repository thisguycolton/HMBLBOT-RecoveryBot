# A group's members, run by its admins: add people by email, approve or turn down join
# requests, make someone an admin, remove people. Host coordinators may also mark who can host.
# Other roles come from offices (Manage > Offices).
class Api::GroupMembershipsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_manager, unless: :marking_hosts?
  before_action :set_membership, only: %i[update destroy]

  # POST /api/groups/:slug/memberships { email, role }
  def create
    user = User.find_by("LOWER(email) = ?", params[:email].to_s.strip.downcase)
    return render(json: { error: "No account uses that email. Send them the invite link instead." }, status: :unprocessable_entity) unless user

    if @group.blocked?(user)
      return render(json: { error: "That person is blocked from this group. Unblock them under Members first." }, status: :unprocessable_entity)
    end

    membership = @group.memberships.find_or_initialize_by(user: user)
    membership.assign_attributes(status: "active", role: params[:role].presence_in(GroupMembership::ROLES) || membership.role || "member")
    return render_errors(membership) unless membership.save

    Notification.deliver(user, kind: "group.added", title: "You were added to #{@group.title}", url: "/groups/#{@group.slug}")
    head :created
  end

  # PATCH /api/groups/:slug/memberships/:id { role, can_host, status: "active" approves a request,
  #   can_keep_records / can_schedule_hosts / can_keep_treasury: false (taking back a role given by
  #   hand before offices gave roles), host_slots_only, host_meeting_ids: [] (that coordinator's slots) }
  # Roles now come from offices (Manage > Offices, OfficeRoles), so they aren't given here.
  def update
    was_request = !@membership.active?
    @membership.role = params[:role] if params[:role].present?
    @membership.status = "active" if params[:status] == "active"
    OfficeRoles::ROLES.each do |role, info|
      next unless params.key?(role)

      on = ActiveModel::Type::Boolean.new.cast(params[role])
      next if on == @membership[role]
      if on
        return render(json: { error: "Roles come from offices now. Give them an office that makes them #{info[:label]} in Manage, Offices." }, status: :unprocessable_entity)
      elsif @membership.office_roles.include?(role)
        return render(json: { error: "Their office makes them #{info[:label]}. Change who holds it, or what it can do, in Manage, Offices." }, status: :unprocessable_entity)
      end
      @membership[role] = false
      @membership.assign_attributes(host_slots_only: false, host_meeting_ids: []) if role == "can_schedule_hosts"
    end
    @membership.can_host = ActiveModel::Type::Boolean.new.cast(params[:can_host]) if params.key?(:can_host)
    if params.key?(:host_slots_only) || params.key?(:host_meeting_ids)
      # An office's time slots are set on the office; these are for a coordinator given the role by hand
      if @membership.office_roles.include?("can_schedule_hosts")
        return render(json: { error: "Their time slots come from their office. Change them in Manage, Offices." }, status: :unprocessable_entity)
      end
      @membership.host_slots_only = ActiveModel::Type::Boolean.new.cast(params[:host_slots_only]) if params.key?(:host_slots_only)
      @membership.host_meeting_ids = @group.meetings.weekly.where(id: Array(params[:host_meeting_ids]).compact_blank).ids.sort if params.key?(:host_meeting_ids)
    end
    if @membership.role_changed? && @membership.role_was == "admin" && @group.admins.count == 1
      return render(json: { error: "A group needs at least one admin." }, status: :unprocessable_entity)
    end
    return render_errors(@membership) unless @membership.save

    if was_request && @membership.active?
      Notification.deliver(@membership.user, kind: "group.joined", title: "You're in #{@group.title}", url: "/groups/#{@group.slug}")
    end
    head :no_content
  end

  # DELETE /api/groups/:slug/memberships/:id (also turns down a join request)
  def destroy
    if @membership.admin? && @membership.active? && @group.admins.count == 1
      return render(json: { error: "A group needs at least one admin." }, status: :unprocessable_entity)
    end

    @membership.destroy!
    head :no_content
  end

  private

  # A host coordinator (not an admin) changing only whether an active member can host
  def marking_hosts?
    action_name == "update" && @group.hosts_editable_by?(current_user) &&
      params.key?(:can_host) && (params.keys & %w[role status can_keep_records can_schedule_hosts can_keep_treasury host_slots_only host_meeting_ids]).empty? &&
      @group.memberships.active.exists?(id: params[:id])
  end

  def set_membership
    @membership = @group.memberships.find(params[:id])
  end
end
