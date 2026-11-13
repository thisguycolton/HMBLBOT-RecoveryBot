# The apps' native sign-in sheets (NativeSignIn): the page asks for a nonce, the app's sheet
# signs in with Google or Apple and returns an ID token carrying it, and the page posts the
# token here. A good token signs them in (kept signed in: it's their phone) and says where to
# go next, the same place a normal log in would (a group invite, a chip claim, and so on).
class Users::NativeSignInsController < ApplicationController
  NONCE_TTL = 10.minutes

  # GET /users/auth/native/nonce
  def nonce
    value = SecureRandom.urlsafe_base64(24)
    session[:native_sign_in_nonce] = { "value" => value, "at" => Time.current.to_i }
    render json: { nonce: value }
  end

  # POST /users/auth/native { provider: google|apple, id_token, given_name, family_name }, and
  # Apple's authorization_code (traded for a refresh token, revoked if the account is deleted)
  def create
    provider = params[:provider].to_s
    return render_error("That isn't a sign-in we know.") unless %w[google apple].include?(provider)

    stored = session.delete(:native_sign_in_nonce) || {}
    fresh = stored["value"].present? && Time.current.to_i - stored["at"].to_i < NONCE_TTL
    return render_error("That sign-in took too long. Please try again.") unless fresh

    audiences = provider == "google" ? NativeSignIn.google_audiences : NativeSignIn.apple_audiences
    claims = IdentityToken.verify(params[:id_token], provider: provider.to_sym, audiences: audiences, nonce: stored["value"])
    name = provider == "google" ? User.short_name(claims["given_name"], claims["family_name"]) : User.short_name(params[:given_name], params[:family_name])
    user = User.from_identity(provider.to_sym, uid: claims["sub"], email: claims["email"], email_verified: claims["email_verified"], name: name)
    unless user
      return render_error("#{provider.capitalize} hasn't confirmed that account's email address yet, so we can't use it to sign you in. Please sign up with your email instead.")
    end

    user.remember_apple_sign_in(params[:authorization_code], client_id: AppleSignIn.bundle_id) if provider == "apple"
    user.remember_me = true
    sign_in(:user, user, event: :authentication)
    flash[:notice] = "Signed in with #{provider.capitalize}."
    render json: { redirect: after_sign_in_path_for(user) }
  rescue IdentityToken::Invalid => e
    Rails.logger.info("[native sign-in] #{provider}: #{e.message}")
    render_error("We couldn't check that sign-in. Please try again, or log in with your email.")
  rescue ActiveRecord::RecordInvalid => e
    render_error("We couldn't make your account: #{e.record.errors.full_messages.to_sentence}. Please sign up with your email instead.")
  end

  private

  def render_error(message) = render(json: { error: message }, status: :unprocessable_entity)
end
