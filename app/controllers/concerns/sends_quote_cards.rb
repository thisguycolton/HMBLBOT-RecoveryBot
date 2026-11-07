# Sends a QuoteCard: shown in the page (the preview), or saved as a file with ?download=1.
# Private to whoever asked, so nothing between keeps it. Words too long for one picture come
# as a GIF that turns its pages (X-Card-Pages says how many); ?still=1 always sends one PNG.
module SendsQuoteCards
  extend ActiveSupport::Concern

  private

  def send_card(picture)
    file = picture.path
    response.headers["Cache-Control"] = "private, max-age=3600"
    response.headers["X-Card-Pages"] = picture.page_count.to_s
    send_file file, type: picture.content_type, filename: picture.filename,
                            disposition: params[:download] == "1" ? "attachment" : "inline"
  rescue ShareCard::Failed => e
    Rails.logger.warn("Quote card failed: #{e.message}")
    render json: { error: "Couldn't make that picture. Try another look." }, status: :unprocessable_entity
  end
end
