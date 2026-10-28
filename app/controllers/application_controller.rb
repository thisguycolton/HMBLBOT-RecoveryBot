class ApplicationController < ActionController::Base
	 #before_action :authenticate_user!
	  after_action :track_action

    protect_from_forgery with: :exception

    before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  # An invite link followed while signed out (GroupsController#join) lands them in the group;
  # otherwise people land on the home page (/people) when it's open to them
  def after_sign_in_path_for(resource)
    token = cookies.signed[:group_invite]
    if token.present? && resource.is_a?(User)
      cookies.delete(:group_invite)
      group = JoinsGroupFromInvite.call(resource, token)
      return "/groups/#{group.slug}" if group
    end
    # A chip's claim link opened while signed out (ChipsController#claim)
    claim = cookies.signed[:chip_claim]
    if claim.present? && resource.is_a?(User)
      cookies.delete(:chip_claim)
      award = ChipAward.find_by(claim_token: claim)
      path = award && ClaimsChip.call(resource, award)
      return path if path
    end
    # "Ask to join" while signed out (GroupsController#ask): back to that group to send it
    slug = cookies.signed[:group_ask]
    if slug.present? && resource.is_a?(User)
      cookies.delete(:group_ask)
      return "/groups/#{slug}?ask=1" if Group.find_by(slug: slug)&.page_visible_to?(resource)
    end
    # Where they were headed, or the home page (notes and what's coming up) once profiles are open to them
    stored = resource.is_a?(User) && stored_location_for(resource)
    return stored if stored
    return "/people" if resource.is_a?(User) && User.profiles_open_to?(resource)

    super
  end

  def track_action
    ahoy.track "Ran action", request.path_parameters
  end

  def configure_permitted_parameters
        devise_parameter_sanitizer.permit(:sign_up) { |u| u.permit(:name, :email, :password, :password_confirmation) }
        devise_parameter_sanitizer.permit(:account_update) { |u| u.permit(:name, :email, :password, :password_confirmation, :current_password) }
  end

end
