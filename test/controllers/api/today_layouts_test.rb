require "test_helper"

class Api::TodayLayoutsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @me = User.create!(email: "me@example.com", name: "Colton", password: "password123", confirmed: true)
  end

  def today = (get("/api/nav", as: :json) && response.parsed_body["today"])

  test "saving a Today layout, and going back to the default" do
    put "/api/today_layout", params: { order: ["events"], hidden: [] }, as: :json
    assert_response :unauthorized

    sign_in @me
    assert_nil today["layout"], "everyone starts on the default"

    put "/api/today_layout", params: { order: %w[meetings day_count bogus meetings greeting], hidden: %w[birthdays nope] }, as: :json
    assert_response :success
    expected = { "order" => %w[meetings day_count greeting], "hidden" => %w[birthdays] }
    assert_equal expected, response.parsed_body["layout"], "unknown and repeated sections are dropped"
    assert_equal expected, today["layout"]

    delete "/api/today_layout", as: :json
    assert_response :success
    assert_nil @me.reload.today_layout
    assert_nil today["layout"]
  end
end
