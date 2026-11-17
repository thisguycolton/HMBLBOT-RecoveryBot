require "test_helper"

class ImmutableAssetsTest < ActionDispatch::IntegrationTest
  test "hashed Vite files are cached for a year, other public files aren't" do
    asset = Dir[Rails.public_path.join("vite-test/assets/*.js")].first
    skip "no Vite build" unless asset

    get "/vite-test/assets/#{File.basename(asset)}"
    assert_response :success
    assert_equal "public, max-age=31536000, immutable", response.headers["cache-control"]

    get "/robots.txt"
    assert_response :success
    assert_not_equal "public, max-age=31536000, immutable", response.headers["cache-control"]
  end
end
