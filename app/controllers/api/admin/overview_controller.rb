# Headline numbers for the admin suite's home page
class Api::Admin::OverviewController < Api::Admin::SuiteController
  def show
    now = Time.current
    zone_now = now.in_time_zone(CourtVerification::TIME_ZONE)
    render json: {
      users: { total: User.count, pending: User.where(confirmed: [false, nil]).count, admins: User.where(admin: true).count },
      readings: {
        published: Reading.published.count,
        scheduled: Reading.scheduled.count,
        drafts: Reading.drafts.count,
      },
      court_verifications: {
        this_month: CourtVerification.where(meeting_at: zone_now.beginning_of_month..).count,
        total: CourtVerification.count,
      },
      visits: {
        today: Ahoy::Visit.where(started_at: zone_now.beginning_of_day..).count,
        last_7_days: Ahoy::Visit.where(started_at: 7.days.ago..).count,
        visitors_7_days: Ahoy::Visit.where(started_at: 7.days.ago..).distinct.count(:visitor_token),
      },
      tags: Tag.count,
      text_reports: { open: TextReport.unresolved.count, resolved: TextReport.resolved.count },
      contact_requests: { open: ContactRequest.unhandled.count, total: ContactRequest.count },
      user_reports: { open: UserReport.unresolved.count, total: UserReport.count },
      notices: { live: SiteNotice.live.count, total: SiteNotice.count },
      tasks: tasks_json,
    }
  end

  private

  # "Tasks that need you" on the Dashboard and the Task board's sidebar count (AdminTask.urgent_for)
  def tasks_json
    urgent = AdminTask.by_urgency(AdminTask.urgent_for(current_user).includes(:assignee, :creator).to_a)
    comments = AdminTaskActivity.where(kind: "comment", admin_task_id: urgent.map(&:id)).group(:admin_task_id).count
    {
      urgent: urgent.first(12).map { |t| t.as_api_json(comments: comments[t.id].to_i) },
      urgent_count: urgent.size,
      open_count: AdminTask.open.count,
      columns: AdminTaskColumn.ordered.map(&:as_api_json),
      me: current_user.id,
    }
  end
end
