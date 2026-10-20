# GET /h/:code: the short link the hosts of a meeting share for one date (HostingSession#code).
# Someone who can host goes to that day's Hosting Command Center; anyone else (no account needed)
# to the page with its chat postings to copy (/groups/:slug/chat/:code). ?sign_in=1 asks them to
# sign in first, then brings them back here.
class HostingLinksController < ApplicationController
  before_action :authenticate_user!, if: -> { params[:sign_in].present? }
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  def show
    hosting = HostingSession.find_by_code(params[:code])
    group = hosting&.meeting&.group
    return redirect_to("/groups/meetings", alert: "That hosting link isn't right. Check it with your host.") unless group&.page_visible_to?(current_user)

    if group.can_host?(current_user)
      redirect_to "/groups/#{group.slug}/host/#{hosting.meeting_id}?on=#{hosting.on.iso8601}"
    else
      redirect_to "/groups/#{group.slug}/chat/#{hosting.code}"
    end
  end
end
