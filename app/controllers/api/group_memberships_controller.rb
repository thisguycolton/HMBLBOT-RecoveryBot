# A group's members, run by its admins: add people by email, approve or turn down join
# requests, change roles, remove people.
class Api::GroupMembershipsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_manager
  before_action :set_membership, only: %i[update destroy]

  # POST /api/groups/:slug/memberships { email, role }
  def create
    user = User.find_by("LOWER(email) = ?", params[:email].to_s.strip.downcase)
    return render(json: { error: "No account uses that email. Send them the invite link instead." }, status: :unprocessable_entity) unless user

    membership = @group.memberships.find_or_initialize_by(user: user)
    membership.assign_attributes(status: "active", role: params[:role].presence_in(GroupMembership::ROLES) || membership.role || "member")
    return render_errors(membership) unless membership.save

    Notification.deliver(user, kind: "group.added", title: "You were added to #{@group.title}", url: "/groups/#{@group.slug}")
    head :created
  end

  # PATCH /api/groups/:slug/memberships/:id { role, can_keep_records, status: "active" approves a request }
  def update
    was_request = !@membership.active?
    @membership.role = params[:role] if params[:role].present?
    @membership.status = "active" if params[:status] == "active"
    @membership.can_keep_records = ActiveModel::Type::Boolean.new.cast(params[:can_keep_records]) if params.key?(:can_keep_records)
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

  def set_membership
    @membership = @group.memberships.find(params[:id])
  end
end
