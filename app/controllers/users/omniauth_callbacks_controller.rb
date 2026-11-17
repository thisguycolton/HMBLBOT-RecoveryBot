# Google sends people back here after "Continue with Google" (GoogleSignIn). The account is
# found, linked or made by User.from_google; then they land wherever a normal log in would
# (ApplicationController#after_sign_in_path_for: a group invite, a chip claim, and so on).
# Started from Account settings ("Link Google", link=1) by someone signed in, it links the
# Google account to theirs instead (LinksIdentities).
class Users::OmniauthCallbacksController < Devise::OmniauthCallbacksController
  include LinksIdentities

  def google_oauth2
    if linking?
      _result, message = link_identity_for(current_user, :google, request.env["omniauth.auth"].uid)
      return redirect_to(SETTINGS_PATH, notice: message)
    end

    user = User.from_google(request.env["omniauth.auth"])
    unless user
      return redirect_to(new_user_session_path,
                         alert: "Google hasn't confirmed that account's email address yet, so we can't use it to sign you in. Please sign up with your email instead.")
    end

    flash[:notice] = "Signed in with Google."
    user.remember_me = true # no "Remember me" box on Google's page, so kept signed in like the box's default
    sign_in_and_redirect user, event: :authentication
  rescue ActiveRecord::RecordInvalid => e
    redirect_to new_user_registration_path, alert: "We couldn't make your account from Google: #{e.record.errors.full_messages.to_sentence}. Please sign up with your email instead."
  end

  # Cancelled on Google's page, or something went wrong on the way back
  def failure
    return redirect_to(SETTINGS_PATH, alert: "Linking Google didn't finish. Please try again.") if linking?

    redirect_to new_user_session_path, alert: "Signing in with Google didn't finish. Please try again, or log in with your email."
  end

  private

  def linking? = user_signed_in? && request.env["omniauth.params"].to_h["link"].present?
end
