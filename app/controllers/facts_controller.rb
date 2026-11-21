# A fun day-count fact (DayFacts) to share with anyone, no account needed:
#   GET /facts/:days       -> a small page with the fact, whose link preview is its picture
#   GET /facts/:days/card  -> the picture itself (FactCard): ?look=color|night|paper|sunrise
#                             &size=square|story|wide &download=1 (saved as a file)
# A shared link carries the look picked (&look=), so its preview matches the picture sent with it.
# Nothing here says whose day count it is.
class FactsController < ApplicationController
  skip_after_action :track_action, only: :card
  before_action :find_fact

  def show
    @look = FactCard::LOOKS.include?(params[:look]) ? params[:look] : nil
    @share = ShareMeta.safely { ShareMeta.fact(@fact, look: @look) }
    render layout: false
  end

  def card
    picture = FactCard.new(@fact, look: params[:look], size: params[:size])
    file = picture.path
    expires_in 1.day, public: true
    send_file file, type: "image/png", filename: picture.filename, disposition: params[:download] == "1" ? "attachment" : "inline"
  rescue ShareCard::Failed => e
    Rails.logger.warn("Fact card failed: #{e.message}")
    render json: { error: "Couldn't make that picture. Try another look." }, status: :unprocessable_entity
  end

  private

  def find_fact
    @fact = DayFacts.find(params[:days])
    head :not_found unless @fact
  end
end
