# Your own profile page's layout in the HMBLBOT Editor (/people/me/edit,
# app/javascript/components/people/ProfileEditor.jsx). Everyone else just looks.
class Api::ProfilePagesController < ApplicationController
  include GroupScoped
  include TakesPageImages

  before_action do
    render(json: { error: "Profiles aren't open yet." }, status: :forbidden) unless User.profiles_open_to?(current_user)
  end

  # PATCH /api/profile_page (multipart when a cover comes along)
  # page: layout, blocks (JSON string or array), cover, remove_cover; reset: back to the default page
  def update
    user = current_user
    attrs = params.require(:page)
    return render(json: { error: "The cover needs to be a JPEG, PNG, WebP or GIF under 10 MB." }, status: :unprocessable_entity) unless cover_ok?(attrs[:cover])

    if ActiveModel::Type::Boolean.new.cast(attrs[:reset])
      user.page_blocks = nil
    else
      user.page_layout = attrs[:layout] if attrs.key?(:layout)
      user.page_blocks = page_blocks_param(attrs[:blocks]) if attrs.key?(:blocks)
    end
    user.profile_cover = attrs[:cover] if attrs[:cover].present?
    return render_errors(user) unless user.save

    user.profile_cover.purge_later if ActiveModel::Type::Boolean.new.cast(attrs[:remove_cover]) && attrs[:cover].blank?
    render json: ProfilePage.new(user).person_json(user.reload)
  end

  # POST /api/profile_page/images { file } -> { url }
  def images
    attach_page_image(current_user.page_images)
  end
end
