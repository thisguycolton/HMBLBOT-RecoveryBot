require "test_helper"

class HostHelperControllerTest < ActionDispatch::IntegrationTest
  test "should get scratchpaper" do
    get host_helper_scratchpaper_url
    assert_response :success
  end
end
