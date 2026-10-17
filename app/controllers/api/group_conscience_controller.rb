# GET /api/groups/:group_slug/conscience: the Overview of the Group conscience tab, for members
# in one go: the next business meeting with its agenda, recent decisions, pinned documents, who
# serves and whose term is nearly up, and what is waiting on a record keeper.
class Api::GroupConscienceController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member

  def show
    ServiceRotation.remind_group!(@group)
    today = @group.zone.today
    json = {
      can_edit: keeper?,
      next_meeting: next_meeting_json,
      recent_decisions: recent_decisions,
      pinned_documents: GroupDocument.visible_to(@group, current_user).where(pinned: true).with_attached_file.ordered.limit(6)
                                     .map { |d| d.as_api_json.slice(:id, :title, :kind, :excerpt, :updated_at, :file) },
      service: @group.service_positions.includes(:terms).ordered.map { |p| p.as_api_json(today: today) }
                     .select { |p| p[:rotation] }.map { |p| p.slice(:id, :title, :rotation, :current) },
    }
    json[:waiting] = waiting if keeper?
    json[:hosts_open] = HostSchedule.new(@group, current_user).summary if @group.hosts_editable_by?(current_user)
    render json: json
  end

  private

  def next_meeting_json
    meeting = BusinessMeeting.next_for(@group, current_user)
    return unless meeting

    meeting.as_api_json(keeper: keeper?).merge(agenda: meeting.agenda_items.includes(:submitted_by).map { |i| i.as_api_json(viewer: current_user) })
  end

  def recent_decisions
    scope = Motion.visible_to(@group, current_user)
    replacers = Motion.replacers_for(@group)
    ids = scope.pluck(:id)
    meetings = BusinessMeeting.visible_to(@group, current_user).pluck(:id)
    scope.decisions.where(status: %w[passed failed]).newest_first.limit(5).map { |m| m.as_api_json(replacers: replacers, visible: ids, meetings: meetings) }
  end

  # Things only a record keeper can move along
  def waiting
    meetings = @group.business_meetings
    {
      draft_minutes: meetings.where(status: "held", minutes_status: "draft").newest_first.limit(5).map { |m| { id: m.id, held_on: m.held_on.iso8601 } },
      suggested_items: AgendaItem.joins(:business_meeting).where(business_meetings: { group_id: @group.id, status: "planned" }, status: "suggested")
                                 .includes(:business_meeting).limit(10).map { |i| { id: i.id, title: i.title, meeting_id: i.business_meeting_id, held_on: i.business_meeting.held_on.iso8601 } },
      draft_documents: @group.documents.where(status: "draft").limit(5).map { |d| { id: d.id, title: d.title } },
      draft_reports: @group.treasurer_reports.where(status: "draft").newest_first.limit(5).map { |r| { id: r.id, period_on: r.period_on.iso8601 } },
    }
  end
end
