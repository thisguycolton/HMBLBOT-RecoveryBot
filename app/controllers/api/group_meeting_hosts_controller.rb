# Who hosts and co-hosts each of a group's weekly meetings (app/models/meeting_host.rb), as a
# schedule (app/services/host_schedule.rb). Members read it; group admins and the members they
# marked as scheduling hosts change it (a coordinator limited to some time slots, only those).
# Putting someone in ends whoever was in that place the day before, and can apply to every day
# the meeting runs. Coordinators of a meeting's time slot hear about each change to it.
class Api::GroupMeetingHostsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :require_scheduler, except: %i[index week]
  before_action :set_host, only: %i[update destroy]
  before_action -> { require_scheduler(@host.meeting) }, only: %i[update destroy]

  # GET /api/groups/:group_slug/meeting_hosts
  def index
    render json: schedule
  end

  # GET /api/groups/:group_slug/meeting_hosts/week?start=YYYY-MM-DD -> that week by date, and
  # the dates you're down for (the Meetings page's week view)
  def week
    render json: HostSchedule.new(@group, current_user).week(params[:start])
  end

  # POST /api/groups/:group_slug/meeting_hosts
  # { meeting_host: { meeting_id, role, name, user_id, starts_on, ends_on, all_days, replace_cover } }
  # A swap made permanent (from the week view) sends replace_cover: the new person holds the
  # place from that date on, so a cover on that very date and an open sub request for it are
  # settled too. Dates before it keep whoever had them.
  def create
    meeting = @group.meetings.weekly.find(params.require(:meeting_host)[:meeting_id])
    return require_scheduler(meeting) unless @group.hosts_editable_by?(current_user, meeting)

    meetings = ActiveModel::Type::Boolean.new.cast(params[:meeting_host][:all_days]) ? meeting.series.to_a : [meeting]
    meetings = meetings.select { |m| @group.hosts_editable_by?(current_user, m) }
    made = []
    MeetingHost.transaction do
      meetings.each do |m|
        host = m.hosts.new(host_params)
        raise ActiveRecord::RecordInvalid, host unless host.valid?

        m.hosts.where(role: host.role).where("meeting_hosts.starts_on < ? AND (meeting_hosts.ends_on IS NULL OR meeting_hosts.ends_on >= ?)", host.starts_on, host.starts_on)
         .update_all(ends_on: host.starts_on - 1.day)
        # someone put in from the very same date never held it: they're replaced, not kept
        # underneath (where they'd come back if the new person stepped down)
        m.hosts.where(role: host.role, starts_on: host.starts_on).delete_all
        host.save!
        settle_date(m, host) if replace_cover?
        made << host
      end
    end
    tell(made.first, meetings.first) if made.first&.user
    made.each { |host| tell_slot_coordinators(host.meeting, "#{host.name} is now #{MeetingHost::ROLE_LABELS[host.role].downcase} from #{host.starts_on.strftime("%b %-d")}") }
    render json: schedule, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render_errors(e.record)
  end

  # PATCH /api/groups/:group_slug/meeting_hosts/:id (a change of dates or name; stepping down sets ends_on)
  def update
    return render_errors(@host) unless @host.update(host_params)

    if @host.saved_change_to_ends_on? && @host.ends_on
      tell_slot_coordinators(@host.meeting, "#{@host.name} steps down as #{MeetingHost::ROLE_LABELS[@host.role].downcase} after #{@host.ends_on.strftime("%b %-d")}")
    end
    render json: schedule
  end

  # POST /api/groups/:group_slug/meeting_hosts/link { name, user_id }
  # Connects everywhere a name is on the schedule (every place and cover written as that name)
  # to a member's account, so they hear about it, get reminders and see their meetings; a blank
  # user_id disconnects them again. The name stays as the group wrote it.
  def link
    name = params.require(:name).to_s.squish
    user = params[:user_id].presence && @group.members.find_by(id: params[:user_id])
    return render(json: { error: "That person isn't a member of the group." }, status: :unprocessable_entity) if params[:user_id].present? && !user

    meeting_ids = @group.coordinated_meeting_ids(current_user) || @group.meetings.select(:id)
    changed = [MeetingHost, MeetingHostCover].sum do |model|
      model.where(meeting_id: meeting_ids).where("LOWER(name) = ?", name.downcase)
           .where("user_id IS DISTINCT FROM ?", user&.id).update_all(user_id: user&.id, updated_at: Time.current)
    end
    if user && changed.positive? && user != current_user
      Notification.deliver(user, kind: "meeting_host.linked", title: "You're on #{@group.title}'s host schedule",
                                 body: "Your account is connected to \"#{name}\" on the schedule. Turn on reminders in your account settings.", url: "/groups/#{@group.slug}/meetings")
    end
    render json: schedule
  end

  # DELETE /api/groups/:group_slug/meeting_hosts/:id
  def destroy
    @host.destroy!
    tell_slot_coordinators(@host.meeting, "#{@host.name} was taken off as #{MeetingHost::ROLE_LABELS[@host.role].downcase}")
    render json: schedule
  end

  private

  def require_scheduler(meeting = nil)
    return if @group.hosts_editable_by?(current_user, meeting)

    error = meeting && @group.hosts_editable_by?(current_user) ? "You coordinate other time slots, not #{meeting.name} on #{meeting.schedule_label}." : "Only host coordinators can do that."
    render json: { error: error }, status: :forbidden
  end

  def set_host
    @host = MeetingHost.joins(:meeting).where(meetings: { group_id: @group.id }).find(params[:id])
  end

  def schedule = HostSchedule.new(@group, current_user).as_json

  def replace_cover? = ActiveModel::Type::Boolean.new.cast(params[:meeting_host][:replace_cover])

  # The swap's own date: the new holder is in, not a cover, and a sub asked for is found
  def settle_date(meeting, host)
    meeting.host_covers.where(role: host.role, on: host.starts_on).delete_all
    meeting.host_sub_requests.open.where(role: host.role, on: host.starts_on)
           .update_all(status: "filled", filled_by_id: host.user_id, updated_at: Time.current)
  end

  # A member can be linked, so they hear they've been put on
  def host_params
    attrs = params.require(:meeting_host).permit(:role, :name, :user_id, :starts_on, :ends_on)
    attrs[:user_id] = nil unless attrs[:user_id].present? && @group.members.exists?(attrs[:user_id])
    attrs[:starts_on] = @group.zone.today.to_s if attrs[:starts_on].blank? && action_name == "create"
    attrs
  end

  # A change to a meeting's schedule, for the coordinators of its time slot (not whoever made it)
  def tell_slot_coordinators(meeting, what)
    Notification.deliver(@group.slot_coordinators(meeting).where.not(id: current_user.id), kind: "meeting_host.slot_changed",
                         title: "#{meeting.name}: #{what}", body: meeting.schedule_label, url: "/groups/#{@group.slug}/meetings")
  end

  def tell(host, meeting)
    return if host.user_id == current_user.id

    Notification.deliver(host.user, kind: "meeting_host.assigned", title: "You're now the #{MeetingHost::ROLE_LABELS[host.role].downcase} of #{meeting.name}",
                                    body: meeting.schedule_label, url: "/groups/#{@group.slug}/meetings")
  end
end
