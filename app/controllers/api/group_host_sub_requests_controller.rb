# "Need a sub": a host coordinator (a group admin, or a member marked as scheduling hosts), or the
# host or co-host who won't be there, asks the group to fill a place at one meeting on one date.
# The members who can host hear about it (every member, if the group hasn't marked any); any
# member can take it, which puts them on as a cover for that date.
class Api::GroupHostSubRequestsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :set_request, only: %i[take destroy]

  # POST /api/groups/:group_slug/host_sub_requests { sub_request: { meeting_id, role, on, note } }
  def create
    attrs = params.require(:sub_request).permit(:meeting_id, :role, :on, :note)
    meeting = @group.meetings.weekly.includes(:hosts, :host_covers).find(attrs[:meeting_id])
    request = meeting.host_sub_requests.new(attrs.except(:meeting_id).merge(requested_by: current_user))
    return require_scheduler unless may_ask_for_sub?(meeting, request)
    return render_errors(request) unless request.save

    Notification.deliver(sub_askees, kind: "meeting_host.sub_needed",
                         title: request.headline, body: request.note || "Can you fill in? Open the Hosts tab to take it.", url: hosts_url)
    render json: schedule, status: :created
  end

  # POST /api/groups/:group_slug/host_sub_requests/:id/take (the member asking covers it)
  def take
    return render(json: { error: "Someone already took that one." }, status: :conflict) unless @request.open?

    meeting = @request.meeting
    HostSubRequest.transaction do
      cover = meeting.host_covers.find_or_initialize_by(role: @request.role, on: @request.on)
      cover.assign_attributes(user: current_user, name: current_user.display_name)
      cover.save!
      @request.update!(status: "filled", filled_by: current_user)
    end
    tell = (@group.host_schedulers.to_a + [@request.requested_by]).compact.uniq - [current_user]
    Notification.deliver(tell, kind: "meeting_host.sub_found", title: "#{current_user.display_name} is covering #{@request.place_label} for #{meeting.name} on #{@request.on.strftime("%b %-d")}",
                               body: meeting.schedule_label, url: hosts_url)
    render json: schedule
  rescue ActiveRecord::RecordInvalid => e
    render_errors(e.record)
  end

  # DELETE /api/groups/:group_slug/host_sub_requests/:id (called off, by a host coordinator or whoever asked)
  def destroy
    return require_scheduler unless @request.requested_by_id == current_user.id

    @request.update!(status: "cancelled") if @request.open?
    render json: schedule
  end

  private

  def require_scheduler
    return if @group.hosts_editable_by?(current_user)

    render json: { error: "Only host coordinators, or the host who won't be there, can ask for a sub." }, status: :forbidden
  end

  # A host coordinator, or the one in that place on that date (covering it, or holding it)
  def may_ask_for_sub?(meeting, request)
    return true if @group.hosts_editable_by?(current_user)
    return false unless request.on.is_a?(Date) && MeetingHost::ROLES.include?(request.role)

    meeting.holder_on(request.role, request.on)&.user_id == current_user.id
  end

  # Who hears that a sub is needed: the members who can host, and the host coordinators (so
  # they know when a host asked for one); every member when nobody is marked as able to host
  def sub_askees
    pool = @group.host_pool.to_a
    people = pool.any? ? pool + @group.host_schedulers.to_a : @group.members.to_a
    people.uniq - [current_user]
  end

  def set_request
    @request = HostSubRequest.joins(:meeting).where(meetings: { group_id: @group.id }).find(params[:id])
  end

  def schedule = HostSchedule.new(@group, current_user).as_json
  def hosts_url = "/groups/#{@group.slug}/hosts"
end
