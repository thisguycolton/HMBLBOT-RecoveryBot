require "test_helper"

# The welcome wizard after sign-up (WelcomeController, Api::WelcomeController)
class WelcomeTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @new = User.create!(email: "new@example.com", name: "Jo K.", password: "password123", confirmed: true)
    @old = User.create!(email: "old@example.com", name: "Al", password: "password123", confirmed: true, onboarded_at: 1.month.ago)
    @busy = Group.create!(title: "Sunrise Serenity", time_zone: "America/Phoenix")
    @quiet = Group.create!(title: "Lunch Bunch", time_zone: "America/Phoenix")
    @busy.memberships.create!(user: @old, role: "admin")
    @quiet.memberships.create!(user: User.create!(email: "x@example.com", name: "X", password: "password123", confirmed: true), role: "admin")
    @busy.memberships.create!(user: User.create!(email: "y@example.com", name: "Y", password: "password123", confirmed: true), role: "member")
    now = Time.current
    OiaaMeeting.create!(slug: "sunrise-steps", name: "Sunrise Step Study", group_name: "Sunrise Step Study", days: [1], start_time: "06:00", time_zone: "America/Phoenix", last_seen_at: now)
    OiaaMeeting.create!(slug: "sunrise-steps-sat", name: "Sunrise Step Study Sat", group_name: "Sunrise Step Study", days: [6], start_time: "08:00", time_zone: "America/Phoenix", last_seen_at: now)
    # already a group here by name, so it shows as that group, not as a listing
    OiaaMeeting.create!(slug: "sunrise-serenity", name: "Sunrise Serenity", group_name: "Sunrise Serenity", days: [2], start_time: "06:30", time_zone: "America/Phoenix", last_seen_at: now)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  test "a new account goes to the welcome wizard after signing in, once" do
    post "/users/sign_in", params: { user: { email: "new@example.com", password: "password123" } }
    assert_redirected_to "/welcome"
    get "/welcome"
    assert_response :success
    props = JSON.parse(css_select("#welcome-page").first["data-props"])
    assert props["first_time"]
    assert props["groups_open"]
    assert_equal "/people", props["next"]

    # leaving part way: the home page sends them back
    get "/people"
    assert_redirected_to "/welcome"

    post "/api/welcome/finish"
    assert_response :no_content
    assert @new.reload.onboarded_at
    get "/people"
    assert_response :success

    delete "/users/sign_out"
    post "/users/sign_in", params: { user: { email: "new@example.com", password: "password123" } }
    assert_redirected_to "/people"
  end

  test "existing accounts never see it" do
    post "/users/sign_in", params: { user: { email: "old@example.com", password: "password123" } }
    assert_redirected_to "/people"
  end

  test "where they were headed comes after the wizard, and only paths on this site" do
    get "/recovery"
    post "/users/sign_in", params: { user: { email: "new@example.com", password: "password123" } }
    assert_redirected_to "/welcome?next=%2Frecovery"

    assert_equal "/welcome", WelcomeController.path(next_path: "//evil.example.com")
    assert_equal "/welcome", WelcomeController.path(next_path: "https://evil.example.com")
    sign_in @new
    get "/welcome", params: { next: "//evil.example.com" }
    assert_equal "/people", JSON.parse(css_select("#welcome-page").first["data-props"])["next"]
  end

  test "suggests the busiest groups here with no search" do
    sign_in @new
    get "/api/welcome/groups"
    body = response.parsed_body
    assert body["suggested"]
    mine = body["groups"].select { |g| [@busy.slug, @quiet.slug].include?(g["slug"]) } # fixtures may add others
    assert_equal [@busy.slug, @quiet.slug], mine.map { |g| g["slug"] }
    assert_equal 2, mine.first["members_count"]
    assert_empty body["listings"]
  end

  test "a search shows groups here first, then listings with no group here, one per group" do
    sign_in @new
    get "/api/welcome/groups", params: { q: "sunrise" }
    body = response.parsed_body
    assert_includes body["groups"].map { |g| g["slug"] }, @busy.slug
    assert_equal ["Sunrise Step Study"], body["listings"].map { |l| l["name"] }
    listing = body["listings"].first
    assert_equal 2, listing["schedules"].size
    refute listing["following"]

    post "/api/intergroup_pages/#{listing['slug']}/follow"
    get "/api/welcome/groups", params: { q: "sunrise" }
    assert response.parsed_body["listings"].first["following"]

    post "/api/groups/#{@busy.slug}/join"
    get "/api/welcome/groups", params: { q: "sunrise" }
    assert_equal "requested", response.parsed_body["groups"].find { |g| g["slug"] == @busy.slug }["membership_status"]
  end

  test "group search is closed while Groups is" do
    ENV.delete("GROUPS_FOR_EVERYONE")
    sign_in @new
    get "/api/welcome/groups"
    assert_response :forbidden
    get "/welcome"
    refute JSON.parse(css_select("#welcome-page").first["data-props"])["groups_open"]
  end
end
