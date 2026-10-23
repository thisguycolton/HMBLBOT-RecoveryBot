# GET /api/topicificator_links/:code: what the live Topicificator window (/topicificator?live=CODE)
# shows, for anyone holding a hosting session's code (the short link's, /h/CODE): the topic the
# hosts have up in HostDeck, its timer and what's been drawn (HostingSession#topicificator_json).
# The window only follows; the hosts control it from their deck. Asking marks the window as
# connected so the deck can say so.
class Api::TopicificatorLinksController < ApplicationController
  CONNECTED_WRITE_EVERY = 4.seconds

  def show
    hosting = HostingSession.find_by_code(params[:code])
    return render(json: { error: "That Topicificator link isn't right. Open it again from HostDeck." }, status: :not_found) unless hosting

    # (not on every poll: the deck needs it fresh to within a few seconds)
    seen = hosting.topicificator_seen_at
    hosting.update_column(:topicificator_seen_at, Time.current) if seen.nil? || seen < CONNECTED_WRITE_EVERY.ago
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["Cache-Control"] = "no-store"
    render json: hosting.topicificator_json
  end
end
