# Your own profile (/users/edit): name, picture, a short blurb, and account details
class Api::ProfilesController < ApplicationController
  before_action :authenticate_user!

  # GET /api/profile
  def show
    render json: profile_json
  end

  # PATCH /api/profile (multipart when a picture is uploaded)
  # name, bio, avatar, remove_avatar=1; email or password also need current_password
  def update
    user = current_user
    attrs = params.require(:profile).permit(:name, :bio, :avatar, :email, :password, :password_confirmation, :current_password)
    user.avatar.purge_later if ActiveModel::Type::Boolean.new.cast(params.dig(:profile, :remove_avatar)) && attrs[:avatar].blank?

    account_change = attrs[:email].present? && attrs[:email].strip.casecmp?(user.email) == false || attrs[:password].present?
    saved = if account_change
              user.update_with_password(attrs.slice(:name, :bio, :avatar, :email, :password, :password_confirmation, :current_password))
            else
              user.update(attrs.slice(:name, :bio, :avatar))
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
      groups: u.group_memberships.includes(:group).map { |m| { slug: m.group.slug, title: m.group.title, role: m.role, status: m.status } },
      groups_open: Group.feature_open_to?(u),
    }
  end
end
