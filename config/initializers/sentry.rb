Sentry.init do |config|
  config.dsn = 'https://219f61840e024bcfb7d17149a0b7d5d0@glitch-tap.hmblbot.com/1'
  config.breadcrumbs_logger = [:active_support_logger, :http_logger]
  # Keep test runs (locally and in CI) from reporting to Sentry.
  config.enabled_environments = %w[production development]
end
