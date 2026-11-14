# The site notices this visitor should see right now (components/SiteNotices.jsx shows
# them as toasts). Public: guests see "everyone" and "guests" notices. The iPhone and Android
# apps don't get notices about getting the app (SiteNotice#about_getting_the_app?).
class Api::SiteNoticesController < ApplicationController
  # GET /api/site_notices
  def index
    render json: SiteNotice.for_viewer(current_user, in_app: native_app?).first(5).map(&:as_api_json)
  end
end
