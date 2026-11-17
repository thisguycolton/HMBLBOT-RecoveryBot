# "Continue with Google" on the log in and sign up pages. It shows only when the Google
# OAuth client is set up (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, see
# config/initializers/devise.rb); the sign-in itself is Users::OmniauthCallbacksController
# and User.from_google.
module GoogleSignIn
  def self.enabled? = Devise.omniauth_configs.key?(:google_oauth2)

  # Where the button posts (OmniAuth only starts a sign-in from a POST with the form's token)
  def self.path = (Rails.application.routes.url_helpers.user_google_oauth2_omniauth_authorize_path if enabled?)
end
