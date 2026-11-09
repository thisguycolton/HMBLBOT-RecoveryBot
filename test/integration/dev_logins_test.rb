require "test_helper"

# The demo login page (Dev::LoginsController) is development-only: its routes shouldn't exist here.
class DevLoginsTest < ActionDispatch::IntegrationTest
  test "the /dev pages are not routed outside development" do
    get "/dev/users"
    assert_response :not_found
    post "/dev/login/anyone"
    assert_response :not_found
  end
end
