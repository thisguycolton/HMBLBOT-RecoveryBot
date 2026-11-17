# Sign-up with HumanCheck in front of it (and a cap on how many accounts one address can
# make), so bots can't fill the site with accounts. Everything else is Devise's own.
class Users::RegistrationsController < Devise::RegistrationsController
  rate_limit to: 5, within: 1.hour, only: :create, with: -> { turn_away("Too many sign-ups from here just now. Please try again later.") }
  prepend_before_action :check_human, only: :create

  # Signing up again with an address whose account was never confirmed (the email didn't come,
  # or they lost it) sends the link again instead of saying the address is taken, which left
  # people stuck. The account keeps the password chosen the first time: a second sign-up isn't
  # proof the address is theirs, so it can't replace it.
  def create
    email = sign_up_params[:email].to_s.strip.downcase
    waiting = email.present? && resource_class.where("lower(email) = ?", email).where(confirmed_at: nil).first
    return super unless waiting

    waiting.resend_confirmation_instructions
    session[:signed_up_email] = waiting.email
    session[:signed_up_again] = true
    redirect_to users_check_email_path
  end

  # "Check your email": where a new account lands until its address is confirmed, so the
  # next step isn't left to a toast that fades.
  def check_email
    email = session[:signed_up_email].to_s
    return redirect_to new_user_registration_path if email.blank?

    flash.delete(:notice) # the page says it, no need for a toast too
    @signed_up_again = session.delete(:signed_up_again).present?
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
