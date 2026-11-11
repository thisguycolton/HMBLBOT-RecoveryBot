# The RecoveryBot iPhone and Android apps (mobile/) load the site in a web view and add
# "RecoveryBotApp/<version> (iOS|Android)" to the user agent. Pages use this to hide what only
# makes sense in a browser (installing to the home screen, web push, Google's sign-in page, which
# Google blocks inside apps) and to load the app's own script (entrypoints/native_app.js).
module NativeAppRequest
  extend ActiveSupport::Concern

  AGENT = %r{RecoveryBotApp/[\d.]+ \((iOS|Android)\)}

  included do
    helper_method :native_app?, :native_platform
  end

  # "ios", "android", or nil in a browser
  def native_platform
    return @native_platform if defined?(@native_platform)
    @native_platform = request.user_agent.to_s[AGENT, 1]&.downcase
  end

  def native_app?
    native_platform.present?
  end
end
