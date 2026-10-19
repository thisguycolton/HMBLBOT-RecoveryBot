ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

class ActiveSupport::TestCase
  # Run tests in parallel with specified workers
  parallelize(workers: :number_of_processors)

  # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
  fixtures :all

  # Add more helper methods to be used by all tests here...
end

class ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  # What the sign-up and contact forms send to pass HumanCheck: a form drawn a little while ago
  def human_check_params(drawn: 10.seconds.ago)
    { HumanCheck::STAMP => HumanCheck.verifier.generate(drawn.to_f, expires_in: HumanCheck::MAX_AGE) }
  end
end
