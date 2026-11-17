require "net/http"

# Checks a sign-in token (an OpenID Connect ID token, a JWT) from Google or Apple: signed with
# one of the provider's published keys, from the provider, for one of our own client IDs, not
# expired, and carrying the nonce we handed out for this sign-in. Used by the apps' native
# sign-in sheets (Users::NativeSignInsController) and Sign in with Apple on the web
# (Users::AppleSignInsController). Returns the token's claims, or raises IdentityToken::Invalid.
#
# Apple's native sheet puts the SHA-256 (hex) of the nonce in the token rather than the nonce
# itself, so either is accepted.
module IdentityToken
  class Invalid < StandardError; end

  PROVIDERS = {
    google: { issuers: ["https://accounts.google.com", "accounts.google.com"], keys: "https://www.googleapis.com/oauth2/v3/certs" },
    apple: { issuers: ["https://appleid.apple.com"], keys: "https://appleid.apple.com/auth/keys" },
  }.freeze

  # Tests swap in their own keys: ->(provider) { { keys: [...] } }
  mattr_accessor :key_source, default: ->(provider) { fetch_keys(provider) }

  module_function

  def verify(token, provider:, audiences:, nonce:)
    config = PROVIDERS.fetch(provider)
    audiences = Array(audiences).compact_blank
    raise Invalid, "#{provider} sign-in isn't set up" if audiences.empty?
    raise Invalid, "no nonce" if nonce.blank?

    claims, = JWT.decode(token.to_s, nil, true,
                         algorithms: ["RS256"], jwks: loader(provider),
                         iss: config[:issuers], verify_iss: true,
                         aud: audiences, verify_aud: true)
    given = claims["nonce"].to_s
    unless [nonce, Digest::SHA256.hexdigest(nonce)].any? { |n| ActiveSupport::SecurityUtils.secure_compare(given, n) }
      raise Invalid, "the nonce doesn't match"
    end
    raise Invalid, "no subject" if claims["sub"].blank?

    claims
  rescue JWT::DecodeError => e
    raise Invalid, e.message
  end

  # The provider's keys, cached for an hour, fetched again when a token names a key we don't
  # have (they rotate them)
  def loader(provider)
    lambda do |options|
      Rails.cache.delete("identity_token/keys/#{provider}") if options[:kid_not_found]
      keys = Rails.cache.fetch("identity_token/keys/#{provider}", expires_in: 1.hour) { key_source.call(provider) }
      JWT::JWK::Set.new(keys)
    end
  end

  def fetch_keys(provider)
    res = Net::HTTP.get_response(URI(PROVIDERS.fetch(provider)[:keys]))
    raise Invalid, "couldn't reach #{provider} to check the sign-in" unless res.is_a?(Net::HTTPSuccess)

    JSON.parse(res.body)
  end

  # The truthy forms providers send: true, "true"
  def truthy?(value) = ActiveModel::Type::Boolean.new.cast(value) == true
end
