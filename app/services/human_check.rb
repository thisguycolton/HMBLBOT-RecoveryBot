# Keeps bots off the sign-up and contact forms. A form carries a signed "started at" stamp and
# an empty decoy field people never see: a post that fills the decoy, comes back too fast to be
# typed, or carries an old or forged stamp is turned away. Forms render it with `HumanCheck.fields`.
#
# On top of that, people tick an "I'm not a robot" box:
# - ALTCHA (the default): the browser works out a small proof-of-work puzzle we signed, so nothing
#   leaves the site and nobody needs an account anywhere. Each solved puzzle is good once.
# - Cloudflare Turnstile instead, when TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY are set.
require "net/http"

module HumanCheck
  DECOY = :website        # the field bots fill in
  STAMP = :form_started   # signed time the form was drawn
  ALTCHA = :altcha        # the widget's solved puzzle
  MIN_SECONDS = 3
  MAX_AGE = 1.day
  ALTCHA_NUMBERS = 20_000..120_000 # how hard the puzzle is: a second or so on a phone
  VERIFY_URL = URI("https://challenges.cloudflare.com/turnstile/v0/siteverify")

  module_function

  # What a form needs: { decoy:, stamp_field:, stamp:, turnstile_site_key: nil | "...", altcha: nil | {challenge} }
  def fields
    { decoy: DECOY.to_s, stamp_field: STAMP.to_s, stamp: verifier.generate(Time.current.to_f, expires_in: MAX_AGE),
      turnstile_site_key: turnstile_site_key, altcha: (altcha_challenge unless turnstile_site_key) }
  end

  # true when the post looks like a person filled it in
  def passed?(params, remote_ip: nil)
    return false if params[DECOY].present?

    started = verifier.verified(params[STAMP].to_s)
    return false unless started.is_a?(Numeric) && Time.current.to_f - started >= MIN_SECONDS

    if turnstile_site_key
      turnstile_passed?(params["cf-turnstile-response"], remote_ip)
    else
      altcha_passed?(params[ALTCHA])
    end
  rescue ActiveSupport::MessageVerifier::InvalidSignature
    false
  end

  # An ALTCHA (v1) puzzle: find the number n for which SHA-256(salt + n) is `challenge`. We sign the
  # challenge so the browser can't make up an easy one, and the salt carries when it expires.
  def altcha_challenge(number: rand(ALTCHA_NUMBERS), expires_at: MAX_AGE.from_now)
    salt = "#{SecureRandom.hex(12)}?expires=#{expires_at.to_i}"
    challenge = Digest::SHA256.hexdigest("#{salt}#{number}")
    { algorithm: "SHA-256", challenge: challenge, maxnumber: ALTCHA_NUMBERS.max, salt: salt, signature: altcha_sign(challenge) }
  end

  def altcha_passed?(encoded)
    payload = JSON.parse(Base64.strict_decode64(encoded.to_s))
    return false unless payload.is_a?(Hash) && payload["algorithm"] == "SHA-256"

    salt, challenge, signature = payload.values_at("salt", "challenge", "signature").map(&:to_s)
    expires = Rack::Utils.parse_query(salt.split("?", 2)[1].to_s)["expires"].to_i
    return false unless expires > Time.current.to_i
    return false unless ActiveSupport::SecurityUtils.secure_compare(Digest::SHA256.hexdigest("#{salt}#{payload['number'].to_i}"), challenge)
    return false unless ActiveSupport::SecurityUtils.secure_compare(altcha_sign(challenge), signature)

    # good once: a solved puzzle can't be posted again
    Rails.cache.write("human_check:altcha:#{challenge}", true, expires_in: MAX_AGE, unless_exist: true) != false
  rescue ArgumentError, JSON::ParserError
    false
  end

  def altcha_sign(challenge) = OpenSSL::HMAC.hexdigest("SHA256", altcha_key, challenge)

  def altcha_key = Rails.application.key_generator.generate_key("human_check altcha")

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
