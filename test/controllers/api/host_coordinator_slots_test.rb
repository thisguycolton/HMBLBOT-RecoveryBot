require "test_helper"

# A host coordinator limited to some time slots (GroupMembership#host_slots_only): changes only
# those meetings, hears about their sub requests and schedule changes, and counts only their open places
class Api::HostCoordinatorSlotsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @admin = User.create!(email: "admin@example.com", name: "Ada", password: "password123", confirmed: true)
    @slotty = User.create!(email: "slotty@example.com", name: "Sam", password: "password123", confirmed: true)
    @whole = User.create!(email: "whole@example.com", name: "Wes", password: "password123", confirmed: true)
    @host = User.create!(email: "host@example.com", name: "Hal", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @admin, role: "admin")
    @slot_membership = @group.memberships.create!(user: @slotty, role: "member", can_schedule_hosts: true)
    @group.memberships.create!(user: @whole, role: "member", can_schedule_hosts: true)
    @group.memberships.create!(user: @host, role: "member", can_host: true)
    @today = @group.zone.today
    @mine = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: @today.wday, start_minute: 420)
    @theirs = @group.meetings.create!(name: "Step Study", recurrence: "weekly", day_of_week: (@today.wday + 1) % 7, start_minute: 1080)
  end

  def limit!
    sign_in @admin
    patch "/api/groups/#{@group.slug}/memberships/#{@slot_membership.id}", params: { host_slots_only: true, host_meeting_ids: [@mine.id, 0] }, as: :json
    assert_response :no_content
    sign_out @admin
  end

  def put_on(meeting, name = "Kim") = post("/api/groups/#{@group.slug}/meeting_hosts", params: { meeting_host: { meeting_id: meeting.id, role: "host", name: name } }, as: :json)

  test "an admin limits a coordinator to time slots, and only the group's weekly meetings stay picked" do
    limit!
    assert @slot_membership.reload.host_slots_only
    assert_equal [@mine.id], @slot_membership.host_meeting_ids

    sign_in @admin
    get "/api/groups/#{@group.slug}/meeting_hosts", as: :json
    assert_response :success, response.body[0, 300]
    coordinators = response.parsed_body["coordinators"]
    assert_equal %w[Sam Wes], coordinators.map { |c| c["name"] }
    assert_equal [true, [@mine.id]], coordinators.first.values_at("host_slots_only", "host_meeting_ids")
  end

  test "a coordinator can't change their own time slots" do
    sign_in @slotty
    patch "/api/groups/#{@group.slug}/memberships/#{@slot_membership.id}", params: { host_slots_only: false }, as: :json
    assert_response :forbidden
  end

  test "a slot coordinator schedules only their slots" do
    limit!
    sign_in @slotty
    put_on @mine
    assert_response :created
    put_on @theirs
    assert_response :forbidden
    assert_match "other time slots", response.parsed_body["error"]

    get "/api/groups/#{@group.slug}/meeting_hosts", as: :json
    body = response.parsed_body
    assert_equal [@mine.id], body["my_slot_ids"]
    assert_equal({ @mine.id => true, @theirs.id => false }, body["slots"].to_h { |s| [s["id"], s["can_edit"]] })
    assert_equal({ "places" => 2, "open_hosts" => 0, "open_co_hosts" => 1 }, body["summary"])
    assert_nil body["coordinators"]

    other = @theirs.hosts.create!(role: "host", name: "Lee", starts_on: @today)
    delete "/api/groups/#{@group.slug}/meeting_hosts/#{other.id}", as: :json
    assert_response :forbidden
    post "/api/groups/#{@group.slug}/meeting_host_covers", params: { cover: { meeting_id: @theirs.id, role: "host", on: (@today + 8).iso8601, name: "Pat" } }, as: :json
    assert_response :forbidden
  end

  test "the whole group's coordinator still schedules every meeting" do
    limit!
    sign_in @whole
    put_on @theirs
    assert_response :created
    get "/api/groups/#{@group.slug}/meeting_hosts", as: :json
    assert_nil response.parsed_body["my_slot_ids"]
    assert_equal 4, response.parsed_body["summary"]["places"]
  end

  test "sub requests reach the coordinators of that slot only" do
    limit!
    sign_in @whole
    post "/api/groups/#{@group.slug}/host_sub_requests", params: { sub_request: { meeting_id: @theirs.id, role: "host", on: (@today + 8).iso8601 } }, as: :json
    assert_response :created
    asked = Notification.where(kind: "meeting_host.sub_needed").pluck(:user_id)
    assert_includes asked, @admin.id
    assert_includes asked, @host.id
    assert_not_includes asked, @slotty.id

    Notification.delete_all
    post "/api/groups/#{@group.slug}/host_sub_requests", params: { sub_request: { meeting_id: @mine.id, role: "host", on: (@today + 7).iso8601 } }, as: :json
    assert_response :created
    assert Notification.exists?(user: @slotty, kind: "meeting_host.sub_needed")
  end

  test "schedule changes in a slot are told to its coordinators" do
    limit!
    sign_in @whole
    assert_difference -> { Notification.where(user: @slotty, kind: "meeting_host.slot_changed").count }, 1 do
      put_on @mine, "Kim"
    end
    assert_no_difference -> { Notification.where(user: @slotty, kind: "meeting_host.slot_changed").count } do
      put_on @theirs, "Lee"
    end
    host = @mine.hosts.sole
    patch "/api/groups/#{@group.slug}/meeting_hosts/#{host.id}", params: { meeting_host: { ends_on: (@today + 3).iso8601 } }, as: :json
    assert_response :success
    assert_match "steps down", Notification.where(user: @slotty, kind: "meeting_host.slot_changed").order(:id).last.title
  end

  test "the group conscience counts only a slot coordinator's open places" do
    limit!
    assert_equal 2, HostSchedule.new(@group, @slotty).summary[:places]
    assert_equal 4, HostSchedule.new(@group, @whole).summary[:places]
  end

  test "a new day of a meeting joins the slots of coordinators who have every other day of it" do
    limit!
    monday = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: (@today.wday + 2) % 7, start_minute: 420)
    assert_includes @slot_membership.reload.host_meeting_ids, monday.id
    other = @group.meetings.create!(name: "Step Study", recurrence: "weekly", day_of_week: (@today.wday + 3) % 7, start_minute: 1080)
    assert_not_includes @slot_membership.reload.host_meeting_ids, other.id
  end
end
