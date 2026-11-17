require "test_helper"

# Site Admin > Members: devices per member, and site-wide writing counts and day counts with no
# names attached (MemberStats).
class Api::Admin::MemberStatsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, name: "Ada Admin", admin: true)
    @lee = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee", sobriety_date: Date.current - 687)
    @old_admins = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "admin@example.com"
  end

  teardown { ENV["ADMIN_EMAILS"] = @old_admins }

  def visit!(user, ua, device_type, at)
    Ahoy::Visit.create!(visit_token: SecureRandom.uuid, visitor_token: SecureRandom.uuid, user: user, user_agent: ua, device_type: device_type, started_at: at)
  end

  test "lists the kinds of devices each member used, and which are active" do
    visit!(@lee, "Mozilla/5.0 (iPhone) AppleWebKit Mobile RecoveryBotApp/1.0 (iOS)", "Mobile", 2.days.ago)
    visit!(@lee, "Mozilla/5.0 (Macintosh) Safari", "Desktop", 90.days.ago)
    PushSubscription.create!(user: @lee, endpoint: "https://fcm.googleapis.com/x", p256dh: "k", auth: "a", user_agent: "Mozilla/5.0 (Linux; Android 14) Chrome Mobile")

    sign_in @admin
    get "/api/admin/users", as: :json
    assert_response :success
    devices = response.parsed_body["users"].find { |u| u["id"] == @lee.id }["devices"]
    by_kind = devices.index_by { |d| d["kind"] }
    assert_equal %w[computer_web ios_app phone_web], by_kind.keys.sort
    assert by_kind["ios_app"]["active"]
    assert_equal "iPhone app", by_kind["ios_app"]["label"]
    assert_not by_kind["computer_web"]["active"]
    assert by_kind["phone_web"]["push"]
  end

  test "site-wide counts never name anyone" do
    3.times { |i| StepInventory.create!(user: @lee, on: Date.current - i) }
    StepInventory.create!(user: @admin, on: Date.current)
    GratitudeList.create!(user: @lee, on: Date.current, items: ["coffee"])

    sign_in @admin
    get "/api/admin/users/stats", as: :json
    assert_response :success
    body = response.parsed_body
    assert_equal 4, body.dig("steps", "total")
    assert_equal 2, body.dig("steps", "people")
    assert_equal 3, body.dig("steps", "most")
    assert_equal 1, body.dig("steps", "buckets").find { |b| b["label"] == "2–4" }["people"]
    assert_equal 1, body.dig("gratitude", "total")
    assert_equal 1, body.dig("day_counts", "with_date")
    assert_equal "A whole year on Mars", body.dig("day_counts", "facts_this_week").first["title"]
    assert_no_match(/Lee|lee@example|Ada/, response.body)
  end

  test "members can't see the stats" do
    sign_in @lee
    get "/api/admin/users/stats", as: :json
    assert_response :forbidden
  end
end
