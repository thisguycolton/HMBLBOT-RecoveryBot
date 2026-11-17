# Sign-up with HumanCheck in front of it (and a cap on how many accounts one address can
# make), so bots can't fill the site with accounts. Everything else is Devise's own.
class Users::RegistrationsController < Devise::RegistrationsController
  rate_limit to: 5, within: 1.hour, only: :create, with: -> { turn_away("Too many sign-ups from here just now. Please try again later.") }
  prepend_before_action :check_human, only: :create

  # "Check your email": where a new account lands until its address is confirmed, so the
  # next step isn't left to a toast that fades.
  def check_email
    email = session[:signed_up_email].to_s
    return redirect_to new_user_registration_path if email.blank?

    flash.delete(:notice) # the page says it, no need for a toast too
    self.resource = resource_class.new(email: email)
  end

  protected

  def after_inactive_sign_up_path_for(resource)
    session[:signed_up_email] = resource.email
    users_check_email_path
  end

  private

  def check_human
    turn_away("That didn't look like a person signing up. Please try again.") unless HumanCheck.passed?(params, remote_ip: request.remote_ip)
  end

  def turn_away(message)
    self.resource = resource_class.new(sign_up_params)
    resource.errors.add(:base, message)
    set_minimum_password_length
    render :new, status: :unprocessable_entity
  end
end
