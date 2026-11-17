# To someone who asked to test the app (/testflight, TestflightRequest) once a site admin marks
# them invited: Google Play sends Android testers nothing when they're added to the closed test,
# so this is how they find out, with the link to join. iPhone requests get TestFlight's public link.
class TesterMailer < ApplicationMailer
  default from: "support@hmblbot.com"

  PLAY_JOIN_URL = "https://play.google.com/apps/testing/com.hmblbot.recoverybot".freeze
  TESTFLIGHT_JOIN_URL = "https://testflight.apple.com/join/fCjuQmFW".freeze

  # params: testflight_request
  def invited
    @request = params[:testflight_request]
    @android = @request.platform == "android"
    @url = @android ? PLAY_JOIN_URL : TESTFLIGHT_JOIN_URL
    mail(to: @request.email, subject: "You're in: try the RecoveryBot #{@request.platform_name} app")
  end
end
