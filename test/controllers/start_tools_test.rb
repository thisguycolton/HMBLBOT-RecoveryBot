require "test_helper"

# The link at the top of a shared gratitude list or 10th step (StartToolsController)
class StartToolsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @kim = User.create!(name: "Kim", email: "kim@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current)
  end

  test "signed in, it opens your own page" do
    sign_in @kim
    get "/start/gratitude"
    assert_redirected_to "/recovery/gratitude"
    get "/start/10th-step"
    assert_redirected_to "/recovery/inventory"
  end

  test "signed out, it goes to sign-up and lands on the page after logging in" do
    get "/start/10th-step"
    assert_redirected_to "/users/sign_up"
    assert_match "10th step", flash[:notice]
    assert_equal "noindex, nofollow", response.headers["X-Robots-Tag"]

    post "/users/sign_in", params: { user: { email: "kim@example.com", password: "password123" } }
    assert_redirected_to "/recovery/inventory"
  end

  test "anything else isn't a page" do
    get "/start/chips"
    assert_response :not_found
  end
end
