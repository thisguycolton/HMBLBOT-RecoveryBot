# GET /h/:code: the short link the hosts of a meeting share for one date (HostingSession#code).
# Someone who can host goes to that day's Hosting Command Center; anyone else (no account needed)
# to the page with its chat postings to copy (/groups/:slug/chat/:code). ?sign_in=1 asks them to
# sign in first, then brings them back here.
# A deck of its own (Deck#share_code, or one of its dates' codes) opens the deck for the group's
# members; anyone else follows it read-only (/groups/:slug/view/:code) when the group allows
# (Deck#guest_access), else is asked to sign in.
class HostingLinksController < ApplicationController
  before_action :authenticate_user!, if: -> { params[:sign_in].present? }
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  def show
    hosting = HostingSession.find_by_code(params[:code])
    deck = hosting&.deck || (Deck.find_by_share_code(params[:code]) unless hosting)
    return deck_link(deck) if deck

    group = hosting&.meeting&.group
    return redirect_to("/groups/meetings", alert: "That hosting link isn't right. Check it with your host.") unless group&.page_visible_to?(current_user)

    if group.can_host?(current_user)
      redirect_to "/groups/#{group.slug}/host/#{hosting.meeting_id}?on=#{hosting.on.iso8601}"
    else
      redirect_to "/groups/#{group.slug}/chat/#{hosting.code}"
    end
  end

  private

  def deck_link(deck)
    group = deck.group
    return redirect_to("/groups/#{group.slug}/decks/#{deck.id}") if group.member_or_site_admin?(current_user)
    return redirect_to("/groups/#{group.slug}/view/#{deck.share_code!}") if deck.guest_view?
    return redirect_to("/groups/meetings", alert: "That link isn't shared with people outside the group.") if current_user

    redirect_to "/h/#{params[:code]}?sign_in=1"
  end
end
