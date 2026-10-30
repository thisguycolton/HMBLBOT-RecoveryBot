# A group's members, run by its admins: add people by email, approve or turn down join
# requests, change roles, remove people. Host coordinators may also mark who can host.
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

  # PATCH /api/groups/:slug/memberships/:id { role, can_keep_records, can_schedule_hosts, can_keep_treasury, can_host, status: "active" approves a request,
  #   host_slots_only, host_meeting_ids: [] (a host coordinator for only these weekly meetings) }
  def update
    was_request = !@membership.active?
    @membership.role = params[:role] if params[:role].present?
    @membership.status = "active" if params[:status] == "active"
    @membership.can_keep_records = ActiveModel::Type::Boolean.new.cast(params[:can_keep_records]) if params.key?(:can_keep_records)
    @membership.can_schedule_hosts = ActiveModel::Type::Boolean.new.cast(params[:can_schedule_hosts]) if params.key?(:can_schedule_hosts)
    @membership.can_keep_treasury = ActiveModel::Type::Boolean.new.cast(params[:can_keep_treasury]) if params.key?(:can_keep_treasury)
    @membership.can_host = ActiveModel::Type::Boolean.new.cast(params[:can_host]) if params.key?(:can_host)
    @membership.host_slots_only = ActiveModel::Type::Boolean.new.cast(params[:host_slots_only]) if params.key?(:host_slots_only)
    if params.key?(:host_meeting_ids)
      @membership.host_meeting_ids = @group.meetings.weekly.where(id: Array(params[:host_meeting_ids]).compact_blank).ids.sort
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
