require "test_helper"

# Finding a meeting and looking at a group need no account; asking to join does.
class GroupsPublicTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @lee = User.create!(email: "lee@example.com", name: "Lee", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @lee, role: "admin")
    @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: 1, start_minute: 420, end_minute: 480)
    @pending = Group.create!(title: "Night Owls", time_zone: "America/Phoenix", status: "pending")
    @lee.timeline_notes.create!(body: "Members only").share_to!([@group])
  end

  test "the finder and a group's pages open without an account" do
    %w[/groups/meetings /groups/find /groups/find/desert-dawn /groups/sunrise-crew /groups/sunrise-crew/events].each do |path|
      get path
      assert_response :success, path
    end
    %w[/groups /groups/new /groups/sunrise-crew/page/edit /groups/sunrise-crew/members /groups/default-page/edit].each do |path|
      get path
      assert_redirected_to new_user_session_path, path
    end

    get "/api/meeting_search", as: :json
    assert_response :success
    assert_includes response.parsed_body.to_json, "Sunrise"

    get "/api/groups/find", params: { q: "Sunrise" }, as: :json
    assert_includes response.parsed_body["groups"].map { |g| g["slug"] }, "sunrise-crew"

    get "/api/groups/sunrise-crew", as: :json
    assert_response :success
    body = response.parsed_body
    assert_equal false, body["signed_in"]
    assert_nil body["members"]
    assert_equal 1, body["meetings"].size

    get "/api/groups/sunrise-crew/page", as: :json
    assert_response :success
    assert_nil response.parsed_body.dig("context", "timeline"), "members' notes stay with members"

    get "/api/groups/#{@pending.slug}", as: :json
    assert_response :not_found, "a group waiting for approval isn't public"
    post "/api/groups/sunrise-crew/join", as: :json
    assert_response :unauthorized
  end

  test "asking to join while signed out sends the request once they sign in" do
    get "/groups/sunrise-crew/ask_to_join"
    assert_redirected_to new_user_registration_path

    post "/users/sign_in", params: { user: { email: "mo@example.com", password: "password123" } }
    assert_redirected_to "/groups/sunrise-crew"
    assert_equal "requested", @group.membership_for(@mo).status
    assert @lee.notifications.exists?(kind: "group.join_request")
  end

  test "anyone signed in can ask to join, even while Groups is admin-only" do
    sign_in @mo
    get "/groups/sunrise-crew"
    assert_response :success
    post "/api/groups/sunrise-crew/join", as: :json
    assert_response :success
    assert_equal "requested", response.parsed_body["membership_status"]
    get "/groups"
    assert_response :success, "once they've asked, Groups is theirs"
  end
end
