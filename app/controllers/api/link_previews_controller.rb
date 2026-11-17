# The card a note will show for a link, while it's being written (LinkPreview). The
# picture comes through us (#image, for a signed address only) so the writer's browser
# doesn't contact the other site either.
class Api::LinkPreviewsController < ApplicationController
  include GroupScoped

  rate_limit to: 30, within: 1.minute, with: -> { render json: { error: "Slow down a little." }, status: :too_many_requests }

  # GET /api/link_preview?url= -> { url, title, description, site_name, image_url } or 404
  def show
    preview = User.profiles_open_to?(current_user) && LinkPreview.fetch(params[:url])
    return render(json: { error: "No preview for that link." }, status: :not_found) unless preview

    image = (api_link_preview_image_path(token: verifier.generate(preview[:image_url], expires_in: 1.hour)) if preview[:image_url])
    render json: preview.slice(:url, :title, :description, :site_name).merge(image_url: image)
  end

  # GET /api/link_preview/image?token= -> the picture
  def image
    url = verifier.verified(params[:token].to_s)
    picture = url && LinkPreview.image(url)
    return head(:not_found) unless picture

    expires_in 1.hour, public: false
    send_data picture[:io].read, type: picture[:content_type], disposition: "inline"
  end

  private

  def verifier = Rails.application.message_verifier(:link_preview_image)
end
