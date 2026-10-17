# The site notices this visitor should see right now (components/SiteNotices.jsx shows
# them as toasts). Public: guests see "everyone" and "guests" notices.
class Api::SiteNoticesController < ApplicationController
  # GET /api/site_notices
  def index
    render json: SiteNotice.for_viewer(current_user).limit(5).map(&:as_api_json)
  end
end
