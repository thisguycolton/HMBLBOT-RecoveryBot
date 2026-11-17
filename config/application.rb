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
    config.beginning_of_week = :sunday
    config.time_zone = "Arizona"
    config.active_record.default_timezone = :local
    # config.eager_load_paths << Rails.root.join("extras")
    config.secret_key_base = ENV['SECRET_KEY_BASE'] || Rails.application.credentials.secret_key_base || 'fallback_key'



    # Log in, sign up and the password pages are React pages in the reader layout
    # (app/views/devise/shared/_auth_page.html.erb). Account settings keep the old layout.
    config.to_prepare do
      Devise::SessionsController.layout "reader"
      Devise::PasswordsController.layout "reader"
      Devise::ConfirmationsController.layout "reader"
      Devise::RegistrationsController.layout ->(c) { %w[new create].include?(c.action_name) ? "reader" : "application" }
      Users::RegistrationsController.layout ->(c) { %w[new create check_email].include?(c.action_name) ? "reader" : "application" }
    end
  end
end
