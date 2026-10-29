require "test_helper"

# Site Admin > Sobriety chips: RecoveryBot's own round chips, the ones members earn
# (ChipDesign.for_site). Chips already earned keep the look they were earned in.
class Api::Admin::ChipDesignTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, name: "Admin", admin: true)
    @member = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee", sobriety_date: Date.current - 400)
  end

  test "only site admins can design them" do
    sign_in @member
    put "/api/admin/chip_design", params: { design: { round: { top_text: "Nope" } } }, as: :json
    assert_response :forbidden
  end

  test "a site admin designs them, and chips already earned keep the look they had" do
    sign_in @admin
    with_admins do
      get "/api/admin/chip_design", as: :json
      assert_equal false, response.parsed_body["customized"]

      travel_to(Time.current) do
        put "/api/admin/chip_design", params: { design: { round: { top_text: "Keep coming back", milestones: { "5y" => { finish: "metal" } } }, meeting: { color: "#ff0000" } } }, as: :json
      end
      assert_response :success
      body = response.parsed_body
      assert_equal [true, "Keep coming back"], [body["customized"], body.dig("design", "round", "top_text")]
      assert_equal({ "5y" => { "finish" => "metal" } }, body.dig("design", "round", "milestones"))
      assert_equal ChipDesign::DEFAULT["meeting"]["color"], body.dig("design", "meeting", "color"), "only the round chips change"
    end

    chips = Chips.catalog(@member)
    year = chips[:chips].find { |c| c[:slot] == Chips.round_slot("year", 1) }
    thirty = chips[:chips].find { |c| c[:milestone]&.dig(:key) == "30d" }
    assert_equal ChipDesign::DEFAULT["round"]["top_text"], year[:design]["round"]["top_text"], "earned before the change: the look it had"
    assert_equal ChipDesign::DEFAULT["round"]["top_text"], thirty[:design]["round"]["top_text"]
    upcoming = chips[:upcoming].find { |c| c[:shape] == "round" }
    assert_equal "Keep coming back", upcoming[:design]["round"]["top_text"], "the next one comes in the new look"
  end

  test "a raised logo for them, from an SVG" do
    sign_in @admin
    with_admins do
      post "/api/admin/chip_design/relief", params: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0 L10 0 L10 10 Z" fill="#000"/></svg>' }, as: :json
      assert_response :success
      assert response.parsed_body.dig("relief", "shapes").present?
    end
  end

  private

  def with_admins
    old = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = @admin.email
    yield
  ensure
    ENV["ADMIN_EMAILS"] = old
  end
end
