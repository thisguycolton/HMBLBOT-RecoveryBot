# "Need a sub": a host coordinator (a group admin, or a member marked as scheduling hosts) asks
# every member to fill a place at one meeting on one date; any member can take it, which puts
# them on as a cover for that date.
class Api::GroupHostSubRequestsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :require_scheduler, only: %i[create destroy]
  before_action :set_request, only: %i[take destroy]

  # POST /api/groups/:group_slug/host_sub_requests { sub_request: { meeting_id, role, on, note } }
  def create
    attrs = params.require(:sub_request).permit(:meeting_id, :role, :on, :note)
    meeting = @group.meetings.weekly.find(attrs[:meeting_id])
    request = meeting.host_sub_requests.new(attrs.except(:meeting_id).merge(requested_by: current_user))
    return render_errors(request) unless request.save

    Notification.deliver(@group.members.where.not(id: current_user.id).to_a, kind: "meeting_host.sub_needed",
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

  # DELETE /api/groups/:group_slug/host_sub_requests/:id (called off)
  def destroy
    @request.update!(status: "cancelled") if @request.open?
    render json: schedule
  end

  private

  def require_scheduler
    return if @group.hosts_editable_by?(current_user)

    render json: { error: "Only host coordinators can ask for a sub." }, status: :forbidden
  end

  def set_request
    @request = HostSubRequest.joins(:meeting).where(meetings: { group_id: @group.id }).find(params[:id])
  end

  def schedule = HostSchedule.new(@group, current_user).as_json
  def hosts_url = "/groups/#{@group.slug}/hosts"
end
