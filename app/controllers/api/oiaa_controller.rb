# Searches of OIAA's meeting directory, for importing and linking a group's meetings
class Api::OiaaController < ApplicationController
  include GroupScoped

  before_action { OiaaFeed.refresh_if_stale }

  # GET /api/oiaa/search?q= (a name, or a Zoom link or meeting ID)
  def search
    render json: { meetings: OiaaMeeting.search(params[:q]).map(&:as_api_json), synced_at: OiaaFeed.last_synced_at&.iso8601 }
  end

  # GET /api/oiaa/matches?name=&group_name=&conference_url=&day=&start_minute=&time_zone=
  # -> the listings most likely to be the meeting being created
  def matches
    found = OiaaFeed.matches(**params.permit(:name, :group_name, :conference_url, :day, :start_minute, :time_zone).to_h.symbolize_keys)
    render json: {
      matches: found.map { |m| m[:record].as_api_json.merge(score: m[:score], day: m[:day], reasons: m[:reasons]) },
      synced_at: OiaaFeed.last_synced_at&.iso8601,
    }
  end
end
