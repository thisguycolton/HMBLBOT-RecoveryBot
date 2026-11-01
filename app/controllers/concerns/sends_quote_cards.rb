# Sends a QuoteCard: shown in the page (the preview), or saved as a file with ?download=1.
# Private to whoever asked, so nothing between keeps it.
module SendsQuoteCards
  extend ActiveSupport::Concern

  private

  def send_card(picture)
    response.headers["Cache-Control"] = "private, max-age=3600"
    send_file picture.path, type: "image/png", filename: picture.filename,
                            disposition: params[:download] == "1" ? "attachment" : "inline"
  rescue ShareCard::Failed => e
    Rails.logger.warn("Quote card failed: #{e.message}")
    render json: { error: "Couldn't make that picture. Try another look." }, status: :unprocessable_entity
  end
end
