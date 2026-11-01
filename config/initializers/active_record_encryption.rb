# Active Record encryption (`encrypts`), used for what's most private: step work answers
# (StepWork) and what a sponsee sends their sponsor (SponsorshipShare). The keys come from
# the credentials' active_record_encryption section or ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY /
# _DETERMINISTIC_KEY / _KEY_DERIVATION_SALT when set, and are otherwise derived from
# secret_key_base, so nothing new is needed to deploy. Changing secret_key_base (without
# first setting these to the old derived values) would make that data unreadable.
unless Rails.application.credentials.dig(:active_record_encryption, :primary_key)
  generator = ActiveSupport::KeyGenerator.new(Rails.application.secret_key_base, iterations: 1000)
  derive = ->(name) { ENV[name].presence || generator.generate_key("active_record_encryption/#{name}", 32).unpack1("H*") }
  keys = {
    primary_key: derive.call("ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY"),
    deterministic_key: derive.call("ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY"),
    key_derivation_salt: derive.call("ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT"),
  }
  keys.each { |k, v| Rails.application.config.active_record.encryption[k] = v }
  ActiveRecord::Encryption.configure(**keys)
end
