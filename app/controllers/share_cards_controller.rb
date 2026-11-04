# GET /share_cards/:kind/:id.png -> the picture a shared link shows (ShareCard), for things
# anyone may open (ShareMeta decides), so link-preview fetchers get it without an account.
# A highlight's is found by its signed share id, so only someone holding its link gets it.
class ShareCardsController < ApplicationController
  skip_after_action :track_action

  def show
    record = find_record
    meta = if record.is_a?(UserHighlight)
      ShareMeta.highlight(record, look: params[:look], note: params[:note] != "0")
    else
      record ? ShareMeta.for(record) : (ShareMeta.site if params[:kind] == "site")
    end
    return head(:not_found) unless meta

    expires_in 1.day, public: true
    send_file meta.card.path, type: "image/png", disposition: "inline"
  rescue ActiveRecord::RecordNotFound
    head :not_found
  rescue ShareCard::Failed => e
    Rails.logger.warn("Share card failed: #{e.message}")
    send_file ShareCard.site.path, type: "image/png", disposition: "inline"
  end

  private

  def find_record
    id = params[:id].to_s
    case params[:kind]
    when "document" then GroupDocument.find(id)
    when "reading" then Reading.find(id)
    when "event" then Event.find_by!(token: id)
    when "group" then Group.find_by!(slug: id)
    when "meeting" then Meeting.find(id)
    when "listing" then OiaaMeeting.find_by!(slug: id)
    when "highlight" then UserHighlight.find_signed(id, purpose: :share) || raise(ActiveRecord::RecordNotFound)
    end
  end
end
