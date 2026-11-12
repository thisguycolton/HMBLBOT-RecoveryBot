# The files that let links to the site open the iPhone and Android apps when they're installed
# (Universal Links and App Links), and let iPhones offer saved passwords in the app:
# - /.well-known/apple-app-site-association: the app (APPLE_TEAM_ID + the bundle ID) may open
#   any page, except sign-in callbacks and file downloads, which have to stay in the browser
# - /.well-known/assetlinks.json: the Android app, signed with one of the certificates in
#   ANDROID_CERT_SHA256 (comma separated SHA-256 fingerprints: the upload key and Google Play's
#   app signing key), may open any page
# Without those set, each says no app. Setup: mobile/SIGN_IN_SETUP.md.
class WellKnownController < ApplicationController
  ANDROID_PACKAGE = "com.hmblbot.recoverybot".freeze
  skip_after_action :track_action # fetched by Apple's and Google's servers, not visits

  # Paths that stay in the browser even with the app installed
  BROWSER_ONLY = ["/users/auth/*", "/rails/active_storage/*", "/.well-known/*"].freeze

  def apple_app_site_association
    app_id = ("#{ENV['APPLE_TEAM_ID']}.#{AppleSignIn.bundle_id}" if ENV["APPLE_TEAM_ID"].present?)
    components = BROWSER_ONLY.map { |path| { "/" => path, "exclude" => true } } + [{ "/" => "*" }]
    expires_in 1.hour, public: true
    render json: {
      applinks: { details: app_id ? [{ appIDs: [app_id], components: components }] : [] },
      webcredentials: { apps: [app_id].compact },
    }
  end

  def assetlinks
    fingerprints = ENV["ANDROID_CERT_SHA256"].to_s.split(",").map(&:strip).compact_blank
    expires_in 1.hour, public: true
    statements = fingerprints.any? ? [{
      relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
      target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
    }] : []
    render json: statements
  end
end
