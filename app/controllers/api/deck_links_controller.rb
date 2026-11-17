# A shared HostDeck of its own, for anyone with its link (/h/CODE, Deck#share_code), signed in or
# not, when the group lets people without an account follow it (Deck#guest_access "view"). They
# see the deck as the hosts have it, read-only; nothing here changes anything. Group members
# have the real deck (Api::DecksController).
class Api::DeckLinksController < ApplicationController
  before_action :set_deck
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow"; response.headers["Cache-Control"] = "no-store" }

  # GET /api/deck_links/:code
  def show
    render json: center.as_json
  end

  # GET /api/deck_links/:code/live: where the hosts are now, for the page to follow
  def live
    render json: center.session.guest_live_json.merge(layout_key: center.layout_key)
  end

  private

  def set_deck
    @deck = Deck.find_by_share_code(params[:code])
    return if @deck&.guest_view?

    render json: { error: "That link isn't shared with people who aren't in the group. Ask the host, or sign in." }, status: :not_found
  end

  def center = @center ||= DeckCenter.new(@deck, nil, guest: true)
end
