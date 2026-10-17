# Someone covering the host's or co-host's place at one meeting on one date (a swap). Same
# people as the schedule itself may set one.
class Api::GroupMeetingHostCoversController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :require_scheduler

  # POST /api/groups/:group_slug/meeting_host_covers { cover: { meeting_id, role, on, name, user_id } }
  # (one cover per place and date: a new one replaces the old)
  def create
    attrs = params.require(:cover).permit(:meeting_id, :role, :on, :name, :user_id)
    meeting = @group.meetings.weekly.find(attrs[:meeting_id])
    user_id = attrs[:user_id].present? && @group.members.exists?(attrs[:user_id]) ? attrs[:user_id] : nil
    cover = meeting.host_covers.find_or_initialize_by(role: attrs[:role], on: attrs[:on])
    cover.assign_attributes(name: attrs[:name], user_id: user_id)
    return render_errors(cover) unless cover.save

    if cover.user && cover.user_id != current_user.id
      Notification.deliver(cover.user, kind: "meeting_host.covering", title: "You're covering as #{MeetingHost::ROLE_LABELS[cover.role].downcase} for #{meeting.name} on #{cover.on.strftime("%b %-d")}",
                                       body: meeting.schedule_label, url: "/groups/#{@group.slug}/hosts")
    end
    render json: HostSchedule.new(@group, current_user).as_json, status: :created
  end

  # DELETE /api/groups/:group_slug/meeting_host_covers/:id
  def destroy
    MeetingHostCover.joins(:meeting).where(meetings: { group_id: @group.id }).find(params[:id]).destroy!
    render json: HostSchedule.new(@group, current_user).as_json
  end

  private

  def require_scheduler
    return if @group.hosts_editable_by?(current_user)

    render json: { error: "Only the people who schedule hosts can do that." }, status: :forbidden
  end
end
