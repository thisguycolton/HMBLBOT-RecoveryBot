# "Find a meeting" (/groups/meetings): AA Intergroup's listings and the groups' own
# meetings, filtered and a page at a time (MeetingFinder). Open to everyone, signed in or not.
class Api::MeetingSearchController < ApplicationController
  include GroupScoped

  skip_before_action :authenticate_user!

  # GET /api/meeting_search?q=&time_zone=&date=&live=&from=&to=&attendance=&place=&type=&page=
  def index
    OiaaFeed.refresh_if_stale
    render json: MeetingFinder.new(current_user, params.permit(:q, :time_zone, :date, :live, :from, :to, :attendance, :place, :type, :page))
  end
end
