require "test_helper"

class UserActiveGroupControllerTest < ActionDispatch::IntegrationTest
  test "should get create" do
    get user_active_group_create_url
    assert_response :success
  end

  test "should get update" do
    get user_active_group_update_url
    assert_response :success
  end
end
