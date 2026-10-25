# Someone covering the host's or co-host's place at one meeting on one date (a swap). Same
# people as the schedule itself may set one (a coordinator limited to time slots, on those), and
# the coordinators of that time slot hear about it.
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
    return require_scheduler(meeting) unless @group.hosts_editable_by?(current_user, meeting)

    user_id = attrs[:user_id].present? && @group.members.exists?(attrs[:user_id]) ? attrs[:user_id] : nil
    cover = meeting.host_covers.find_or_initialize_by(role: attrs[:role], on: attrs[:on])
    cover.assign_attributes(name: attrs[:name], user_id: user_id)
    return render_errors(cover) unless cover.save

    meeting.host_sub_requests.open.where(role: cover.role, on: cover.on).update_all(status: "filled", filled_by_id: cover.user_id, updated_at: Time.current)

    if cover.user && cover.user_id != current_user.id
      Notification.deliver(cover.user, kind: "meeting_host.covering", title: "You're covering as #{MeetingHost::ROLE_LABELS[cover.role].downcase} for #{meeting.name} on #{cover.on.strftime("%b %-d")}",
                                       body: meeting.schedule_label, url: "/groups/#{@group.slug}/hosts")
    end
    Notification.deliver(@group.slot_coordinators(meeting).where.not(id: [current_user.id, cover.user_id].compact), kind: "meeting_host.slot_changed",
                         title: "#{meeting.name}: #{cover.name} covers the #{MeetingHost::ROLE_LABELS[cover.role].downcase} on #{cover.on.strftime("%b %-d")}",
                         body: meeting.schedule_label, url: "/groups/#{@group.slug}/hosts")
    render json: HostSchedule.new(@group, current_user).as_json, status: :created
  end

  # DELETE /api/groups/:group_slug/meeting_host_covers/:id
  def destroy
    cover = MeetingHostCover.joins(:meeting).where(meetings: { group_id: @group.id }).find(params[:id])
    return require_scheduler(cover.meeting) unless @group.hosts_editable_by?(current_user, cover.meeting)

    cover.destroy!
    render json: HostSchedule.new(@group, current_user).as_json
  end

  private

  def require_scheduler(meeting = nil)
    return if @group.hosts_editable_by?(current_user, meeting)

    error = meeting ? "You coordinate other time slots, not #{meeting.name} on #{meeting.schedule_label}." : "Only host coordinators can do that."
    render json: { error: error }, status: :forbidden
  end
end
