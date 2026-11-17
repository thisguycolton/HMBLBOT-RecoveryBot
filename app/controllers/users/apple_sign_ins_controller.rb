# Sign in with Apple on the website (AppleSignIn). The button posts here with the page's token;
# we send them to Apple with a fresh state and nonce, kept in a short-lived cookie that can
# come back with Apple's cross-site POST (SameSite=None). Apple posts back an ID token, which
# must carry the same nonce, and the account is found, linked or made (User.from_identity).
#
# Started from Account settings ("Link Apple", link=1) by someone signed in, the cookie also
# carries who they are, since Apple's cross-site POST comes back without the session cookie;
# the Apple ID is then linked to that account (LinksIdentities) and they stay signed in.
class Users::AppleSignInsController < ApplicationController
  include LinksIdentities
  COOKIE = :apple_sign_in
  # Apple's page posts the answer from its own site, without our form token
  skip_forgery_protection only: :callback

  # POST /users/auth/apple
  def start
    return redirect_to(new_user_session_path, alert: "Sign in with Apple isn't set up yet.") unless AppleSignIn.web_enabled?

    state = SecureRandom.urlsafe_base64(24)
    nonce = SecureRandom.urlsafe_base64(24)
    value = { "state" => state, "nonce" => nonce }
    value["link_user"] = current_user.id if params[:link].present? && user_signed_in?
    cookies.signed[COOKIE] = { value: value, expires: 10.minutes, httponly: true,
                               secure: request.ssl?, same_site: request.ssl? ? :none : :lax }
    redirect_to AppleSignIn.authorize_url(redirect_uri: callback_url, state: state, nonce: nonce), allow_other_host: true
  end

  # POST /users/auth/apple/callback { state, id_token, code, user } or { error }. The code is
  # traded for a refresh token, so deleting the account can revoke it (AppleSignIn).
  def callback
    saved = cookies.signed[COOKIE] || {}
    cookies.delete(COOKIE)
    @linking = saved["link_user"] && User.find_by(id: saved["link_user"])
    sign_in(:user, @linking) if @linking # back in the new session this answer starts
    return failed("Signing in with Apple didn't finish. Please try again, or log in with your email.") if params[:error].present?
    unless saved["state"].present? && ActiveSupport::SecurityUtils.secure_compare(saved["state"], params[:state].to_s)
      return failed("That sign-in took too long. Please try again.")
    end

    claims = IdentityToken.verify(params[:id_token], provider: :apple, audiences: [AppleSignIn.services_id], nonce: saved["nonce"])
    return link_apple(claims) if @linking

    user = User.from_identity(:apple, uid: claims["sub"], email: claims["email"], email_verified: claims["email_verified"],
                                      name: AppleSignIn.name_from(params[:user]))
    return failed("Apple hasn't confirmed that account's email address, so we can't use it to sign you in. Please sign up with your email instead.") unless user

    user.remember_apple_sign_in(params[:code], client_id: AppleSignIn.services_id, redirect_uri: callback_url)
    user.remember_me = true # no "Remember me" box on Apple's page, so kept signed in like the box's default
    flash[:notice] = "Signed in with Apple."
    sign_in_and_redirect user, event: :authentication
  rescue IdentityToken::Invalid => e
    Rails.logger.info("[apple sign-in] #{e.message}")
    failed("We couldn't check that sign-in with Apple. Please try again, or log in with your email.")
  rescue ActiveRecord::RecordInvalid => e
    redirect_to new_user_registration_path, alert: "We couldn't make your account from Apple: #{e.record.errors.full_messages.to_sentence}. Please sign up with your email instead."
  end

  private

  def link_apple(claims)
    result, message = link_identity_for(@linking, :apple, claims["sub"])
    @linking.remember_apple_sign_in(params[:code], client_id: AppleSignIn.services_id, redirect_uri: callback_url) if result == :linked
    redirect_to SETTINGS_PATH, notice: message
  end

  def callback_url = "#{request.base_url}/users/auth/apple/callback"

  def failed(message)
    return redirect_to(SETTINGS_PATH, alert: "Linking Apple didn't finish. Please try again.") if @linking

    redirect_to(new_user_session_path, alert: message)
  end
end
