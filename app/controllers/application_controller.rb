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
    # "Ask to join" pressed while signed out (GroupsController#ask_to_join): send the request now
    slug = cookies.signed[:group_request]
    if slug.present? && resource.is_a?(User)
      cookies.delete(:group_request)
      group = Group.find_by(slug: slug)
      if group&.viewable_by?(resource)
        group.request_to_join!(resource)
        return "/groups/#{group.slug}"
      end
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
