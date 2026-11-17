# GET /api/card_progress/:token: how far along the share picture or video asked for with
# ?progress=<token> is (SendsQuoteCards), so the page can fill a progress ring while it waits.
# { stage: "waiting" | "drawing" | "encoding" | "done", percent: 0..100 }, or 204 when nothing
# has been noted yet (it's just started, or it was already drawn and on its way).
class Api::CardProgressController < ApplicationController

  def show
    note = CardProgress.read(params[:token], current_user&.id)
    response.headers["Cache-Control"] = "no-store"
    return head(:no_content) unless note

    render json: note
  end
end
