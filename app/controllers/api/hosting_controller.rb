# What a host or co-host serves (HostCommitments), for the account menu's "Court verification":
# the meetings they hold a place in, and the groups they can host for
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
    }
  end

  private

  def days_label(days)
    return "Every day" if days.size == 7

    days.map { |d| Date::ABBR_DAYNAMES[d] }.join(", ")
  end
end
