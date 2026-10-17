# POST .../images { file } -> { url }: a picture for a block on a page made in the HMBLBOT
# Editor, attached to `attachments` (a has_many_attached) so it stays as long as the page
module TakesPageImages
  extend ActiveSupport::Concern

  private

  def attach_page_image(attachments)
    file = params[:file]
    unless file.respond_to?(:content_type) && Event::IMAGE_TYPES.include?(file.content_type)
      return render(json: { error: "Pictures need to be JPEG, PNG, WebP or GIF." }, status: :unprocessable_entity)
    end
    return render(json: { error: "Pictures need to be under 10 MB." }, status: :unprocessable_entity) if file.size > 10.megabytes

    blob = ActiveStorage::Blob.create_and_upload!(io: file, filename: file.original_filename, content_type: file.content_type)
    attachments.attach(blob)
    render json: { url: Rails.application.routes.url_helpers.rails_storage_proxy_path(blob, only_path: true) }, status: :created
  end

  def page_blocks_param(raw)
    raw.is_a?(String) ? JSON.parse(raw) : Array(raw)
  rescue JSON::ParserError
    []
  end

  def cover_ok?(file)
    return true if file.blank?

    Event::IMAGE_TYPES.include?(file.content_type) && file.size <= 10.megabytes
  end
end
