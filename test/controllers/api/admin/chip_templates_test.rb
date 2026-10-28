require "test_helper"

# Site Admin > Chip templates (Api::Admin::ChipTemplatesController)
class Api::Admin::ChipTemplatesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []
  SVG = %(<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g id="sky"><rect width="10" height="10" fill="#9fd0ee"/></g></svg>)

  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @boss = User.create!(email: "boss@example.com", password: "password123", confirmed: true, name: "Boss", admin: true)
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim")
  end

  teardown { ENV["ADMIN_EMAILS"] = @env }

  test "only suite admins" do
    sign_in @kim
    get "/api/admin/chip_templates", as: :json
    assert_response :forbidden
  end

  test "import a draft, paint it, publish versions, and retire it" do
    sign_in @boss
    post "/api/admin/chip_templates", params: { svg: SVG, title: "Sky" }, as: :json
    assert_response :created
    t = response.parsed_body
    assert_equal ["Sky", "draft", true], t.values_at("title", "status", "changed")
    art = t.dig("draft", "art")
    art["layers"][0]["shapes"][0]["fill"] = "#1c2a55"
    art["layers"][0]["locked"] = true

    patch "/api/admin/chip_templates/#{t['id']}", params: { template: { art: art, palettes: { "Day" => { "#1c2a55" => "#9fd0ee" } }, defaults: { finish: "struck" } } }, as: :json
    assert_response :success
    assert_equal "#1c2a55", response.parsed_body.dig("draft", "art", "layers", 0, "shapes", 0, "fill")
    assert response.parsed_body.dig("draft", "art", "layers", 0, "locked")

    post "/api/admin/chip_templates/#{t['id']}/publish", as: :json
    assert_equal [1, "published", false], response.parsed_body.values_at("version", "status", "changed")

    get "/api/admin/chip_templates", as: :json
    assert_includes response.parsed_body["templates"].map { |x| x["title"] }, "Sky"

    post "/api/admin/chip_templates", params: { svg: "<svg/>" }, as: :json
    assert_response :unprocessable_entity
    assert_match "shapes", response.parsed_body["error"]

    delete "/api/admin/chip_templates/#{t['id']}", as: :json
    assert_equal "retired", ChipTemplate.find(t["id"]).status, "published art is retired, not deleted"
  end
end
