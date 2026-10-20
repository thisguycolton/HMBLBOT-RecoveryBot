# GET /api/hosting_links/:code: what the short link's page shows (HostingCenter#public_json), to
# anyone with the link, signed in or not: the meeting's chat postings for that date, filled in, and
# which have gone out. The group's kit can keep them to hosts (HostingKit#public_postings).
class Api::HostingLinksController < ApplicationController
  def show
    hosting = HostingSession.find_by_code(params[:code])
    group = hosting&.meeting&.group
    return render(json: { error: "That hosting link isn't right. Check it with your host." }, status: :not_found) unless group&.page_visible_to?(current_user)

    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    render json: HostingCenter.new(group, hosting.meeting, current_user, on: hosting.on).public_json
  end
end
