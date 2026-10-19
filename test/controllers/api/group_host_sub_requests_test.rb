require "test_helper"

class Api::GroupHostSubRequestsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @coordinator = User.create!(email: "coord@example.com", name: "Cam", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @other_member = User.create!(email: "other-member@example.com", name: "Ola", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @coordinator, role: "member", can_schedule_hosts: true)
    @group.memberships.create!(user: @member, role: "member")
    @group.memberships.create!(user: @other_member, role: "member")
    @today = @group.zone.today
    @meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: @today.wday, start_minute: 420)
    @on = @today + 7
  end

  def path(*rest) = ["/api/groups/#{@group.slug}/host_sub_requests", *rest].join("/")
  def ask = post(path, params: { sub_request: { meeting_id: @meeting.id, role: "host", on: @on.iso8601, note: "Out of town" } }, as: :json)

  test "only host coordinators ask for a sub" do
    sign_in @member
    ask
    assert_response :forbidden
  end

  test "asking tells every other member, and taking it puts them on for that date" do
    sign_in @coordinator
    assert_difference -> { Notification.where(kind: "meeting_host.sub_needed").count }, 2 do
      ask
    end
    assert_response :created
    request = response.parsed_body["sub_requests"].sole
    assert_equal ["host", @on.iso8601, "Out of town"], request.values_at("role", "on", "note")

    ask
    assert_response :unprocessable_entity

    sign_in @member
    post path(request["id"], "take"), as: :json
    assert_response :success
    assert_empty response.parsed_body["sub_requests"]
    cover = @meeting.host_covers.sole
    assert_equal [@member, "host", @on], [cover.user, cover.role, cover.on]
    assert Notification.exists?(user: @coordinator, kind: "meeting_host.sub_found")

    sign_in @other_member
    post path(request["id"], "take"), as: :json
    assert_response :conflict
  end

  test "a date the meeting doesn't meet is refused, and a coordinator can call it off" do
    sign_in @coordinator
    post path, params: { sub_request: { meeting_id: @meeting.id, role: "host", on: (@on + 1).iso8601 } }, as: :json
    assert_response :unprocessable_entity

    ask
    id = response.parsed_body["sub_requests"].sole["id"]
    delete path(id), as: :json
    assert_response :success
    assert_equal "cancelled", HostSubRequest.find(id).status
  end
end
