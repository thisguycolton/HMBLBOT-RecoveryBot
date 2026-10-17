# Who hosts and co-hosts each of a group's weekly meetings (app/models/meeting_host.rb), as a
# schedule (app/services/host_schedule.rb). Members read it; group admins and the members they
# marked as scheduling hosts change it. Putting someone in ends whoever was in that place the
# day before, and can apply to every day the meeting runs.
class Api::GroupMeetingHostsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :require_scheduler, except: :index
  before_action :set_host, only: %i[update destroy]

  # GET /api/groups/:group_slug/meeting_hosts
  def index
    render json: schedule
  end

  # POST /api/groups/:group_slug/meeting_hosts
  # { meeting_host: { meeting_id, role, name, user_id, starts_on, ends_on, all_days } }
  def create
    meeting = @group.meetings.weekly.find(params.require(:meeting_host)[:meeting_id])
    meetings = ActiveModel::Type::Boolean.new.cast(params[:meeting_host][:all_days]) ? meeting.series.to_a : [meeting]
    made = []
    MeetingHost.transaction do
      meetings.each do |m|
        host = m.hosts.new(host_params)
        raise ActiveRecord::RecordInvalid, host unless host.valid?

        m.hosts.where(role: host.role).where("meeting_hosts.starts_on < ? AND (meeting_hosts.ends_on IS NULL OR meeting_hosts.ends_on >= ?)", host.starts_on, host.starts_on)
         .update_all(ends_on: host.starts_on - 1.day)
        host.save!
        made << host
      end
    end
    tell(made.first, meetings.first) if made.first&.user
    render json: schedule, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render_errors(e.record)
  end

  # PATCH /api/groups/:group_slug/meeting_hosts/:id (a change of dates or name; stepping down sets ends_on)
  def update
    @host.update(host_params) ? render(json: schedule) : render_errors(@host)
  end

  # DELETE /api/groups/:group_slug/meeting_hosts/:id
  def destroy
    @host.destroy!
    render json: schedule
  end

  private

  def require_scheduler
    return if @group.hosts_editable_by?(current_user)

    render json: { error: "Only the people who schedule hosts can do that." }, status: :forbidden
  end

  def set_host
    @host = MeetingHost.joins(:meeting).where(meetings: { group_id: @group.id }).find(params[:id])
  end

  def schedule = HostSchedule.new(@group, current_user).as_json

  # A member can be linked, so they hear they've been put on
  def host_params
    attrs = params.require(:meeting_host).permit(:role, :name, :user_id, :starts_on, :ends_on)
    attrs[:user_id] = nil unless attrs[:user_id].present? && @group.members.exists?(attrs[:user_id])
    attrs[:starts_on] = @group.zone.today.to_s if attrs[:starts_on].blank? && action_name == "create"
    attrs
  end

  def tell(host, meeting)
    return if host.user_id == current_user.id

    Notification.deliver(host.user, kind: "meeting_host.assigned", title: "You're now the #{MeetingHost::ROLE_LABELS[host.role].downcase} of #{meeting.name}",
                                    body: meeting.schedule_label, url: "/groups/#{@group.slug}/hosts")
  end
end
