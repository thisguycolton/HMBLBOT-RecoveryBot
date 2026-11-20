# The site notices this visitor should see right now (components/SiteNotices.jsx shows
# them as toasts). Public: guests see "everyone" and "guests" notices. The platform comes from the
# app's user agent (NativeAppRequest), and the apps send their build number (lib/appInfo.js), so a
# notice can go to some devices or older app builds only (SiteNotice#shown_to?).
class Api::SiteNoticesController < ApplicationController
  # GET /api/site_notices?build=5&push=0
  # push: whether this phone gets the app's notifications (1/0), for "App, notifications off"
  def index
    build = params[:build].presence&.to_i
    push = { "1" => true, "0" => false }[params[:push].to_s]
    render json: SiteNotice.for_viewer(current_user, platform: native_platform || "web", build: build, push: push)
                           .first(5).map(&:as_api_json)
  end
end
