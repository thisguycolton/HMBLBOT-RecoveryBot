# A group's business meetings (app/models/business_meeting.rb): when, the agenda, the minutes.
# Members read them (draft minutes stay with record keepers); record keepers schedule and
# write; group admins delete. A group admin can have an Event made to announce one.
class Api::GroupBusinessMeetingsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :require_keeper, only: %i[create update]
  before_action :require_manager, only: :destroy
  before_action :set_meeting, only: %i[show update destroy]

  # GET /api/groups/:group_slug/business_meetings
  def index
    meetings = BusinessMeeting.visible_to(@group, current_user).includes(:event, :meeting, :agenda_items, :motions).newest_first
    render json: { meetings: meetings.map { |m| m.as_api_json(keeper: keeper?) }, can_edit: keeper?, can_delete: @group.manageable_by?(current_user),
                   can_make_events: @group.manageable_by?(current_user), regular_meetings: regular_meetings,
                   quorum: { count: @group.quorum_count, percent: @group.quorum_percent, needed: @group.quorum_needed } }.merge(MotionKinds.metadata)
  end

  # GET /api/groups/:group_slug/business_meetings/:id
  def show
    render json: meeting_json
  end

  # POST /api/groups/:group_slug/business_meetings { business_meeting: {...}, create_event: true }
  def create
    wants_event = ActiveModel::Type::Boolean.new.cast(params[:create_event])
    return render(json: { error: "Only this group's admins can make an event." }, status: :forbidden) if wants_event && !@group.manageable_by?(current_user)

    @meeting = @group.business_meetings.new(created_by: current_user)
    assign
    BusinessMeeting.transaction do
      raise ActiveRecord::Rollback unless @meeting.save

      @meeting.update!(event: announcement_event) if wants_event
    end
    return render_errors(@meeting) unless @meeting.persisted?

    tell_members_it_is_scheduled
    render json: meeting_json, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render_errors(e.record)
  end

  # PATCH /api/groups/:group_slug/business_meetings/:id
  def update
    assign
    return render_errors(@meeting) unless @meeting.save

    tell_members_minutes_are_up if @meeting.saved_change_to_minutes_posted_at? && @meeting.minutes_posted_at_before_last_save.nil?
    render json: meeting_json
  end

  # DELETE /api/groups/:group_slug/business_meetings/:id (group admins). Its decisions stay in the log.
  def destroy
    @meeting.destroy!
    head :no_content
  end

  private

  def set_meeting
    @meeting = BusinessMeeting.visible_to(@group, current_user).find(params[:id])
  end

  def assign
    attrs = params.require(:business_meeting).permit(:held_on, :status, :visibility, :chair_name, :secretary_name, :attendance_count,
                                                     :minutes, :minutes_status, :meeting_id, :starts_time, :called_to_order_time, :adjourned_time)
    time = attrs.delete(:starts_time)
    called = attrs.delete(:called_to_order_time)
    adjourned = attrs.delete(:adjourned_time)
    @meeting.assign_attributes(attrs)
    @meeting.set_start(time) if params[:business_meeting].key?(:starts_time) || @meeting.new_record?
    @meeting.set_times(called_to_order: called, adjourned: adjourned)
  end

  def regular_meetings
    @group.meetings.ordered.map { |m| { id: m.id, name: m.name } }.uniq { |m| m[:name] }
  end

  def meeting_json
    visible = Motion.visible_to(@group, current_user)
    meetings = BusinessMeeting.visible_to(@group, current_user).pluck(:id)
    replacers = Motion.replacers_for(@group)
    ids = visible.pluck(:id)
    @meeting.reload.as_api_json(keeper: keeper?).merge(
      agenda: @meeting.agenda_items.includes(:submitted_by).map { |i| i.as_api_json(viewer: current_user) },
      motions: visible.where(business_meeting_id: @meeting.id).includes(:parent, business_meeting: :group).order(:id)
                      .map { |m| m.as_api_json(replacers: replacers, visible: ids, meetings: meetings, keeper: keeper?) },
      can_edit: keeper?, can_delete: @group.manageable_by?(current_user), can_suggest: @meeting.planned?
    ).tap { |json| json[:unfinished] = unfinished_json if keeper? && @meeting.planned? }
  end

  # Motions put off at earlier meetings that this agenda could take up
  def unfinished_json
    @meeting.unfinished_business.map do |m|
      { id: m.id, title: m.title, status: m.status, decided_on: m.decided_on&.iso8601, committee: m.committee, postponed_to: m.postponed_to,
        meeting_held_on: m.business_meeting&.held_on&.iso8601 }
    end
  end

  # A draft event with the live agenda in it; its date can be picked with a schedule poll
  def announcement_event
    @group.events.create!(
      title: "#{@group.title} business meeting", created_by: current_user, time_zone: @group.time_zone, starts_at: @meeting.starts_at,
      blocks: [
        { type: "heading", region: "main", text: "Group conscience", level: 2 },
        { type: "notes", region: "main", markdown: "Our business meeting. Everyone in the group has a voice and a vote." },
        { type: "conscience_agenda", region: "main" },
      ]
    )
  end

  def tell_members_it_is_scheduled
    return unless @meeting.planned? && @meeting.held_on >= @group.zone.today

    who = @meeting.visibility == "members" ? @group.members : @group.record_keepers
    Notification.deliver(who.where.not(id: current_user.id), kind: "business_meeting.scheduled",
                         title: "#{@group.title} has a business meeting #{@meeting.when_label}",
                         body: "See the agenda and suggest an item.", url: "/groups/#{@group.slug}/conscience/meetings/#{@meeting.id}")
  end

  def tell_members_minutes_are_up
    return unless @meeting.visibility == "members"

    Notification.deliver(@group.members.where.not(id: current_user.id), kind: "business_meeting.minutes",
                         title: "Minutes from #{@group.title}'s business meeting on #{@meeting.held_on.strftime("%b %-d")} are posted",
                         url: "/groups/#{@group.slug}/conscience/meetings/#{@meeting.id}")
  end
end
