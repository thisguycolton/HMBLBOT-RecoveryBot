# Keeps bots off the sign-up and contact forms without sending anyone to a third party.
# A form carries a signed "started at" stamp and an empty decoy field people never see:
# a post that fills the decoy, comes back too fast to be typed, or carries an old or
# forged stamp is turned away. Forms render it with `HumanCheck.fields`.
#
# Cloudflare Turnstile is added on top when TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are
# set (the widget then shows on both forms); unset, nothing leaves the site.
require "net/http"

module HumanCheck
  DECOY = :website        # the field bots fill in
  STAMP = :form_started   # signed time the form was drawn
  MIN_SECONDS = 3
  MAX_AGE = 1.day
  VERIFY_URL = URI("https://challenges.cloudflare.com/turnstile/v0/siteverify")

  module_function

  # What a form needs: { decoy: "website", stamp_field: "form_started", stamp: "...", turnstile_site_key: nil | "..." }
  def fields
    { decoy: DECOY.to_s, stamp_field: STAMP.to_s, stamp: verifier.generate(Time.current.to_f, expires_in: MAX_AGE),
      turnstile_site_key: turnstile_site_key }
  end

  # true when the post looks like a person filled it in
  def passed?(params, remote_ip: nil)
    return false if params[DECOY].present?

    started = verifier.verified(params[STAMP].to_s)
    return false unless started.is_a?(Numeric) && Time.current.to_f - started >= MIN_SECONDS

    turnstile_site_key.nil? || turnstile_passed?(params["cf-turnstile-response"], remote_ip)
  rescue ActiveSupport::MessageVerifier::InvalidSignature
    false
  end

  def turnstile_site_key = ENV["TURNSTILE_SITE_KEY"].presence && ENV["TURNSTILE_SECRET_KEY"].presence && ENV["TURNSTILE_SITE_KEY"]

  def turnstile_passed?(token, remote_ip)
    return false if token.blank?

    res = Net::HTTP.post_form(VERIFY_URL, secret: ENV["TURNSTILE_SECRET_KEY"], response: token, remoteip: remote_ip.to_s)
    JSON.parse(res.body)["success"] == true
  rescue StandardError => e
    Rails.logger.warn("Turnstile check failed: #{e.message}")
    false
  end

  def verifier = Rails.application.message_verifier("human_check")
end
