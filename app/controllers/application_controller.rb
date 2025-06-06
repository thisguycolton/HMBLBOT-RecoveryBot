class ApplicationController < ActionController::Base
	 #before_action :authenticate_user!
	  after_action :track_action

    protect_from_forgery with: :exception

    before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  def track_action
    ahoy.track "Ran action", request.path_parameters
  end

  def configure_permitted_parameters
        devise_parameter_sanitizer.permit(:sign_up) { |u| u.permit(:name, :email, :password)}
        devise_parameter_sanitizer.permit(:account_update) { |u| u.permit(:name, :email, :password, :current_password)}
  end

end
