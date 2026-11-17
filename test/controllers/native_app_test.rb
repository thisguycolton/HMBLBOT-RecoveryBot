require "test_helper"

# The iPhone and Android apps (mobile/) load the site with "RecoveryBotApp/<version> (iOS|Android)"
# in the user agent (NativeAppRequest)
class NativeAppTest < ActionDispatch::IntegrationTest
  IPHONE_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 RecoveryBotApp/1.0 (iOS)"
  ANDROID_APP = "Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0 Mobile Safari/537.36 RecoveryBotApp/1.0 (Android)"
  IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

  setup { Rails.application.reload_routes_unless_loaded }

  test "the apps get their own script and are marked on the page" do
    get "/users/sign_in", headers: { "User-Agent" => IPHONE_APP }
    assert_response :success
    assert_includes response.body, %(data-native-app="ios")
    assert_includes response.body, "native_app"

    get "/users/sign_in", headers: { "User-Agent" => ANDROID_APP }
    assert_includes response.body, %(data-native-app="android")
  end

  test "a browser gets neither" do
    get "/users/sign_in", headers: { "User-Agent" => IPHONE_SAFARI }
    assert_response :success
    assert_not_includes response.body, "data-native-app"
    assert_not_includes response.body, "native_app"
  end

  test "the apps don't offer Google, which blocks its sign-in page inside apps" do
    get "/users/sign_in", headers: { "User-Agent" => IPHONE_APP }
    assert_includes response.body, "google_path&quot;:null"
    get "/users/sign_up", headers: { "User-Agent" => ANDROID_APP }
    assert_not_includes response.body, "/users/auth/google_oauth2"

    get "/users/sign_up", headers: { "User-Agent" => IPHONE_SAFARI }
    assert_includes response.body, "/users/auth/google_oauth2"
  end

  test "the install page sends the apps home" do
    get "/install", headers: { "User-Agent" => IPHONE_APP }
    assert_redirected_to "/"
    get "/install", headers: { "User-Agent" => IPHONE_SAFARI }
    assert_response :success
  end

  test "the ask-to-test page sends the apps home too" do
    get "/testflight", headers: { "User-Agent" => ANDROID_APP }
    assert_redirected_to "/"
    get "/testflight", headers: { "User-Agent" => IPHONE_SAFARI }
    assert_response :success
  end

  test "the widgets' key says who's signed in, their sobriety date and first favorite chip" do
    get "/users/sign_in", headers: { "User-Agent" => IPHONE_APP }
    assert_includes response.body, %(data-widget="") # signed out: the app clears the widgets

    user = users(:one)
    user.update_columns(sobriety_date: Date.new(2024, 3, 1), chip_favorites: ["round:year-1"])
    sign_in user
    get "/recovery", headers: { "User-Agent" => IPHONE_APP }
    assert_includes response.body, %(data-widget="#{user.id}|2024-03-01|round:year-1")

    get "/recovery", headers: { "User-Agent" => IPHONE_SAFARI }
    assert_not_includes response.body, "data-widget"
  end

  test "the app's user agent isn't taken for a robot" do
    assert_no_match KeepsRobotsOut::ROBOT_AGENT, IPHONE_APP
    assert_no_match KeepsRobotsOut::ROBOT_AGENT, ANDROID_APP
  end
end
