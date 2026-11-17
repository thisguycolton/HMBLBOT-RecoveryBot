require "test_helper"

# RecoveryBot's own Special Editions (ChipEdition without a group, Site Admin > Sobriety chips):
# site admins make them with the same limits and numbering as a group's; any member can claim a
# claimable one, and given-only ones go out through Give a chip > Admin Chips, capped or not.
class Api::SiteChipEditionsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    travel_to Time.zone.local(2026, 10, 28, 12)
    @admin = User.create!(email: "boss@example.com", password: "password123", confirmed: true, name: "Boss", admin: true)
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim", sobriety_date: Date.new(2026, 7, 30)) # 90 days on Oct 28
    @lee = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee", sobriety_date: Date.new(2025, 10, 1)) # 1 year on Oct 1
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = @admin.email
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def make(**attrs)
    sign_in @admin
    post "/api/admin/chip_editions", params: { edition: { name: "Founders", kind: "milestone", starts_on: "2026-10-01", ends_on: "2026-12-31", window: "custom", **attrs } }, as: :json
    assert_response :created, response.body
    edition = response.parsed_body["edition"]
    post "/api/admin/chip_editions/#{edition['id']}/publish", as: :json
    assert_response :success
    edition
  end

  def available_for(user)
    sign_in user
    get "/api/recovery?today=#{Date.current.iso8601}", as: :json
    response.parsed_body["available"]
  end

  test "a claimable one: any member (no group needed) claims it, numbered, from RecoveryBot" do
    edition = make(how_many: "first_n", limit: 5)
    assert_nil ChipEdition.find(edition["id"]).group
    assert_equal [["round:90d", "RecoveryBot"]], available_for(@kim).map { |a| [a["slot"], a.dig("group", "title")] }

    post "/api/recovery/claim", params: { edition_id: edition["id"], slot: "round:90d" }, as: :json
    assert_response :created
    assert_equal "FOUNDERS · NO. 001 OF 5", response.parsed_body.dig("chip", "edition", "mark")
    assert_equal "RecoveryBot", response.parsed_body.dig("chip", "group", "title")
  end

  test "a given-only one with no cap: nobody claims it, admins give it as many times as they like" do
    edition = make(how_many: "given_n", limit: nil)
    assert_nil ChipEdition.find(edition["id"]).limit
    assert_empty available_for(@kim)

    sign_in @admin
    get "/api/chip_awards", as: :json
    admin_choice = response.parsed_body["groups"].find { |g| g["admin"] }
    assert_equal [[edition["id"], nil]], admin_choice["editions"].map { |e| [e["id"], e["left"]] }
    [[@kim, "90d"], [@lee, "year"]].each do |user, key|
      post "/api/chip_awards", params: { group_slug: "_admin", user_id: user.id, milestone_key: key, years: 1, chip_edition_id: edition["id"] }, as: :json
      assert_response :created, response.body
    end
    assert_equal ["FOUNDERS · NO. 001", "FOUNDERS · NO. 002"], ChipAward.order(:id).map { |a| a.as_chip_json[:edition][:mark] }
  end

  test "only site admins make them, and groups' admin pages don't see them" do
    sign_in @kim
    get "/api/admin/chip_editions", as: :json
    assert_response :forbidden
    post "/api/admin/chip_editions", params: { edition: { name: "Nope", kind: "milestone", starts_on: "2026-10-01", ends_on: "2026-12-31" } }, as: :json
    assert_response :forbidden
  end
end
