require "test_helper"

# Site admins give RecoveryBot's own chips (Site Admin > Sobriety chips) on Give a chip, as
# "Admin Chips" in From: to anyone, from no group. Nobody else can.
class Api::AdminChipAwardsTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @admin = User.create!(email: "boss@example.com", password: "password123", confirmed: true, name: "Boss", admin: true)
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim Lee")
    @host = User.create!(email: "host@example.com", password: "password123", confirmed: true, name: "Host")
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = @admin.email
    ChipDesign.save_site!("round" => { "colors" => { "30d" => "#112233" } })
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  test "a site admin sees Admin Chips, finds anyone by name, and gives the site's chip from RecoveryBot" do
    sign_in @admin
    get "/api/recovery"
    assert response.parsed_body["can_give"]

    get "/api/chip_awards"
    choice = response.parsed_body["groups"].find { |g| g["admin"] }
    assert_equal ["_admin", "Admin Chips", "#112233"], [choice["slug"], choice["title"], choice.dig("design", "round", "colors", "30d")]

    get "/api/chip_awards/lookup", params: { group_slug: "_admin", q: "kim" }
    assert_equal ["Kim Lee"], response.parsed_body["members"].map { |m| m["name"] }

    post "/api/chip_awards", params: { group_slug: "_admin", user_id: @kim.id, milestone_key: "30d", note: "Well done" }
    assert_response :created
    award = ChipAward.last
    assert_nil award.group
    assert award.claimed?
    assert_equal "#112233", award.design.dig("round", "colors", "30d")
    assert_equal "RecoveryBot", award.as_chip_json[:group][:title]
    assert @kim.notifications.exists?(kind: "chip.given", title: "Boss gave you a 30 days chip")

    get "/api/chip_awards"
    assert_equal ["RecoveryBot"], response.parsed_body["given"].map { |a| a["group_title"] }
    delete "/api/chip_awards/#{award.id}"
    assert_response :no_content
  end

  test "an emailed Admin Chip says it's from RecoveryBot" do
    sign_in @admin
    assert_emails 1 do
      perform_enqueued_jobs do
        post "/api/chip_awards", params: { group_slug: "_admin", email: "new@example.com", milestone_key: "year", years: 2 }
      end
    end
    assert_response :created
    assert_match "RecoveryBot sent you a 2 years chip", ActionMailer::Base.deliveries.last.subject
  end

  test "nobody else gets Admin Chips" do
    sign_in @host
    get "/api/chip_awards"
    assert_empty response.parsed_body["groups"]
    post "/api/chip_awards", params: { group_slug: "_admin", user_id: @kim.id, milestone_key: "30d" }
    assert_response :forbidden
    get "/api/chip_awards/lookup", params: { group_slug: "_admin", q: "kim" }
    assert_response :forbidden
  end
end
