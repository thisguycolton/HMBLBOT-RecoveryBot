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
    }
  end
end
