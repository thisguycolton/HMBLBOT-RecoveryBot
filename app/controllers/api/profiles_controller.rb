# Your own profile (/users/edit): name, picture, a short blurb, and account details
class Api::ProfilesController < ApplicationController
  before_action :authenticate_user!

  # GET /api/profile
  def show
    render json: profile_json
  end

  # PATCH /api/profile (multipart when a picture is uploaded)
  # name, bio, avatar, remove_avatar=1, sobriety_date, show_sobriety_date, username,
  # default_highlight_visibility, default_note_visibility; email or password also need current_password
  def update
    user = current_user
    attrs = params.require(:profile).permit(:name, :bio, :avatar, :sobriety_date, :show_sobriety_date, :username, :default_highlight_visibility, :default_note_visibility, :email, :password, :password_confirmation, :current_password)
    user.avatar.purge_later if ActiveModel::Type::Boolean.new.cast(params.dig(:profile, :remove_avatar)) && attrs[:avatar].blank?

    attrs[:username] = attrs[:username].to_s.strip.downcase if attrs.key?(:username)
    profile = %i[name bio avatar sobriety_date show_sobriety_date username default_highlight_visibility default_note_visibility]
    account_change = attrs[:email].present? && attrs[:email].strip.casecmp?(user.email) == false || attrs[:password].present?
    saved = if account_change
              user.update_with_password(attrs.slice(*profile, :email, :password, :password_confirmation, :current_password))
            else
              user.update(attrs.slice(*profile))
            end
    return render(json: { error: user.errors.full_messages.to_sentence }, status: :unprocessable_entity) unless saved

    bypass_sign_in(user) if attrs[:password].present?
    render json: profile_json
  end

  private

  def profile_json
    u = current_user.reload
    {
      name: u.name, email: u.email, bio: u.bio, avatar_url: u.avatar_url,
      sobriety_date: u.sobriety_date&.iso8601, show_sobriety_date: u.show_sobriety_date,
      groups: u.group_memberships.includes(:group).map { |m| { slug: m.group.slug, title: m.group.title, role: m.role, status: m.status } },
      groups_open: Group.feature_open_to?(u),
      username: u.username, profile_path: u.profile_path, profiles_open: User.profiles_open_to?(u),
      default_highlight_visibility: u.default_highlight_visibility, default_note_visibility: u.default_note_visibility,
    }
  end
end
