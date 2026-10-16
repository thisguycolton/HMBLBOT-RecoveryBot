class ApplicationController < ActionController::Base
	 #before_action :authenticate_user!
	  after_action :track_action

    protect_from_forgery with: :exception

    before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  # An invite link followed while signed out (GroupsController#join) lands them in the group
  def after_sign_in_path_for(resource)
    token = cookies.signed[:group_invite]
    if token.present? && resource.is_a?(User)
      cookies.delete(:group_invite)
      group = JoinsGroupFromInvite.call(resource, token)
      return "/groups/#{group.slug}" if group
    end
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
