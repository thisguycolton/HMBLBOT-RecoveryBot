# What a host or co-host serves (HostCommitments), for the account menu's "Court verification"
# and the Hosting page: the meetings they hold a place in, the groups they can host for, their
# coming dates and the "Need a sub" requests they could take
class Api::HostingController < ApplicationController
  before_action :authenticate_user!

  # GET /api/hosting
  def show
    commitments = HostCommitments.new(current_user)
    render json: {
      meetings: commitments.series.map do |s|
        m = s[:meeting]
        { group_slug: s[:group].slug, group_title: s[:group].title, meeting_id: m.id, name: m.name, roles: s[:roles],
          label: "#{days_label(s[:days])} · #{Meeting.clock(m.start_minute)}",
          court_url: "/court_verifications/new?group=#{s[:group].slug}&meeting=#{m.id}" }
      end,
      groups: commitments.groups.select(&:active?).map { |g| { slug: g.slug, title: g.title, court_url: "/court_verifications/new?group=#{g.slug}" } },
      # The Hosting page (/people/me/hosting): their coming dates, and subs they could take
      upcoming: commitments.upcoming(to: 2.weeks.from_now).map do |c|
        { meeting_id: c.meeting.id, name: c.meeting.name, group_slug: c.meeting.group.slug, group_title: c.meeting.group.title,
          role: c.role, role_label: MeetingHost::ROLE_LABELS[c.role], starts_at: c.starts_at.iso8601, cover: c.cover }
      end,
      open_requests: commitments.open_sub_requests.map do |r|
        r.as_api_json.merge(name: r.meeting.name, group_slug: r.meeting.group.slug, group_title: r.meeting.group.title,
                            place: r.place_label, at: Meeting.clock(r.meeting.start_minute))
      end,
    }
  end

  private

  def days_label(days)
    return "Every day" if days.size == 7

    days.map { |d| Date::ABBR_DAYNAMES[d] }.join(", ")
  end
end
