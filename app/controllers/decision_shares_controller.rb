# A group decision its record keepers shared by link (Motion#share!): /d/:token, for anyone,
# no account needed. The page (site.jsx, DecisionSharePage) shows only Motion#public_json: the
# wording and how it came out, never who moved or seconded it. A link that was turned off, or
# never was, is a plain "not found". Search engines and crawlers are kept out; the apps that
# draw link previews get the title and outcome.
class DecisionSharesController < ApplicationController
  include KeepsRobotsOut

  layout "reader"
  before_action :find_decision
  after_action :tag_noindex
  after_action { response.headers["Referrer-Policy"] = "no-referrer" }

  def show
    @share = ShareMeta.safely { ShareMeta.decision(@motion) }
    if robot_request?
      return link_preview(@share) if link_preview_request? && @share

      return turn_robots_away
    end
    @props = { decision: @motion.public_json }
  end

  private

  def find_decision
    @motion = Motion.includes(:group).find_shared(params[:token])
    return if @motion

    response.headers["X-Robots-Tag"] = ROBOTS_TAG
    render plain: "This link isn't shared any more, or it was never a decision's link.", status: :not_found
  end
end
