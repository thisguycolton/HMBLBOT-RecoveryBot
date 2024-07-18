require_relative "boot"

require "rails/all"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module AcidTest
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 7.0

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    config.time_zone = "Arizona"
    config.active_record.default_timezone = :local
    # config.eager_load_paths << Rails.root.join("extras")
    config.secret_key_base = ENV['SECRET_KEY_BASE'] || Rails.application.credentials.secret_key_base || 'fallback_key'


  end
end
