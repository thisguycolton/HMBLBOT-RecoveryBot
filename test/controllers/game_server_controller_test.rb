require "test_helper"

class GameServerControllerTest < ActionDispatch::IntegrationTest
  test "should get getting_started" do
    get game_server_getting_started_url
    assert_response :success
  end

  test "should get plugin_faq" do
    get game_server_plugin_faq_url
    assert_response :success
  end
end
