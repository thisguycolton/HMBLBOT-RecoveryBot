# The RecoveryBot iPhone and Android apps (mobile/) load the site in a web view and add
# "RecoveryBotApp/<version> (iOS|Android)" to the user agent. Pages use this to hide what only
# makes sense in a browser (installing to the home screen, web push, Google's sign-in page, which
# Google blocks inside apps) and to load the app's own script (entrypoints/native_app.js).
module NativeAppRequest
  extend ActiveSupport::Concern

  AGENT = %r{RecoveryBotApp/[\d.]+ \((iOS|Android)\)}

  included do
    helper_method :native_app?, :native_platform, :native_widget_key
  end

  # "ios", "android", or nil in a browser
  def native_platform
    return @native_platform if defined?(@native_platform)
    @native_platform = request.user_agent.to_s[AGENT, 1]&.downcase
  end

  def native_app?
    native_platform.present?
  end

  # What the app's home-screen widgets show (the day count and a favorite chip) changes when this
  # does: who's signed in, their sobriety date and their first favorite chip. The app's script
  # (lib/appWidgets.js) refreshes the widgets when it changes, and clears them when it's blank,
  # signed out.
  def native_widget_key
    return "" unless native_app? && user_signed_in?

    [current_user.id, current_user.sobriety_date&.iso8601, current_user.chip_favorites.first].join("|")
  end
end
