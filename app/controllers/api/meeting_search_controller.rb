# "Find a meeting" (/groups/meetings): AA Intergroup's listings and the groups' own
# meetings, filtered and a page at a time (MeetingFinder). Open to whoever sees Groups.
class Api::MeetingSearchController < ApplicationController
  include GroupScoped

  # GET /api/meeting_search?q=&time_zone=&date=&live=&from=&to=&attendance=&place=&type=&page=
  def index
    return render(json: { error: "Groups isn't open yet." }, status: :forbidden) unless Group.feature_open_to?(current_user)

    OiaaFeed.refresh_if_stale
    render json: MeetingFinder.new(current_user, params.permit(:q, :time_zone, :date, :live, :from, :to, :attendance, :place, :type, :page))
  end
end
