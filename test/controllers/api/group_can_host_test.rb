require "test_helper"

# Members who can host or co-host: who marks them, the format kept for hosts, and who hears
# when a host won't be there
class Api::GroupCanHostTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @admin = User.create!(email: "admin@example.com", name: "Ada", password: "password123", confirmed: true)
    @coordinator = User.create!(email: "coord@example.com", name: "Cam", password: "password123", confirmed: true)
    @host = User.create!(email: "host@example.com", name: "Hal", password: "password123", confirmed: true)
    @spare = User.create!(email: "spare@example.com", name: "Sam", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @admin, role: "admin")
    @group.memberships.create!(user: @coordinator, role: "member", can_schedule_hosts: true)
    @host_membership = @group.memberships.create!(user: @host, role: "member", can_host: true)
    @spare_membership = @group.memberships.create!(user: @spare, role: "member")
    @member_membership = @group.memberships.create!(user: @member, role: "member")
    @today = @group.zone.today
    @meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: @today.wday, start_minute: 420)
    @meeting.hosts.create!(role: "host", user: @host, starts_on: @today - 30)
    @on = @today + 7
    @format = @group.documents.create!(title: "Host script", kind: "format", body: "Open with the Preamble", visibility: "hosts")
  end

  def mark(membership, value) = patch("/api/groups/#{@group.slug}/memberships/#{membership.id}", params: { can_host: value }, as: :json)
  def sub_path(*rest) = ["/api/groups/#{@group.slug}/host_sub_requests", *rest].join("/")
  def ask(role = "host") = post(sub_path, params: { sub_request: { meeting_id: @meeting.id, role: role, on: @on.iso8601 } }, as: :json)

  test "admins and host coordinators mark who can host; members can't, and coordinators can't change anything else" do
    sign_in @coordinator
    mark @spare_membership, true
    assert_response :no_content
    assert @spare_membership.reload.can_host

    patch "/api/groups/#{@group.slug}/memberships/#{@spare_membership.id}", params: { can_host: false, role: "admin" }, as: :json
    assert_response :forbidden
    assert_equal "member", @spare_membership.reload.role

    sign_in @member
    mark @member_membership, true
    assert_response :forbidden

    sign_in @admin
    mark @spare_membership, false
    assert_response :no_content
    assert_not @spare_membership.reload.can_host
  end

  test "documents kept for hosts are read by people who can host, not by other members" do
    sign_in @member
    get "/api/groups/#{@group.slug}/documents", as: :json
    assert_not_includes response.parsed_body["documents"].map { |d| d["title"] }, "Host script"
    get "/api/groups/#{@group.slug}/meeting_hosts", as: :json
    assert_empty response.parsed_body["formats"]

    sign_in @host
    get "/api/groups/#{@group.slug}/documents/#{@format.id}", as: :json
    assert_response :success
    get "/api/groups/#{@group.slug}/meeting_hosts", as: :json
    assert_equal ["Host script"], response.parsed_body["formats"].map { |d| d["title"] }
    assert_equal ["host"], response.parsed_body["slots"].sole["mine"]
    assert response.parsed_body["can_host"]

    sign_in @coordinator
    get "/api/groups/#{@group.slug}/documents/#{@format.id}", as: :json
    assert_response :success
  end

  test "the host can say they won't be there, and the members who can host hear about it" do
    @group.update!(sub_requests_audience: "hosts")
    @spare_membership.update!(can_host: true)
    sign_in @host
    ask "co_host"
    assert_response :forbidden

    assert_difference -> { Notification.where(kind: "meeting_host.sub_needed").count }, 3 do
      ask
    end
    assert_response :created
    told = Notification.where(kind: "meeting_host.sub_needed").pluck(:user_id)
    assert_equal [@admin, @coordinator, @spare].map(&:id).sort, told.sort

    id = response.parsed_body["sub_requests"].sole["id"]
    assert response.parsed_body["sub_requests"].sole["asked_by_me"]
    delete sub_path(id), as: :json
    assert_response :success
    assert_equal "cancelled", HostSubRequest.find(id).status
  end

  test "someone who isn't in the place can't ask, and every member hears when nobody is marked" do
    sign_in @member
    ask
    assert_response :forbidden

    @host_membership.update!(can_host: false)
    sign_in @coordinator
    assert_difference -> { Notification.where(kind: "meeting_host.sub_needed").count }, 4 do
      ask
    end
  end

  test "who sees sub requests: all members by default, only hosts, or off (coordinators always)" do
    sign_in @host
    ask
    id = response.parsed_body["sub_requests"].sole["id"]
    seen = ->(user) do
      sign_in user
      get "/api/groups/#{@group.slug}/meeting_hosts", as: :json
      response.parsed_body["sub_requests"].map { |r| r["id"] }.include?(id)
    end
    badge = ->(user) { HostCommitments.new(user).open_sub_requests.map(&:id).include?(id) }

    assert_equal "members", @group.sub_requests_audience
    assert seen.(@member)
    assert badge.(@member)

    @group.update!(sub_requests_audience: "hosts")
    assert_not seen.(@member)
    assert_not badge.(@member)
    @spare_membership.update!(can_host: true)
    assert seen.(@spare)
    assert seen.(@coordinator)

    @group.update!(sub_requests_audience: "off")
    assert_not seen.(@spare)
    assert_not badge.(@spare)
    assert seen.(@coordinator), "coordinators always see their meetings' requests"
    assert seen.(@host), "whoever asked still sees their own request"

    sign_in @spare
    post sub_path(id, "take"), as: :json
    assert_response :forbidden
    assert_equal "open", HostSubRequest.find(id).status
  end

  test "turned off, only the meeting's coordinators hear a sub is needed" do
    @group.update!(sub_requests_audience: "off")
    sign_in @host
    ask
    assert_equal [@admin, @coordinator].map(&:id).sort, Notification.where(kind: "meeting_host.sub_needed").pluck(:user_id).sort
  end

  test "group admins choose who sees sub requests; members can't" do
    sign_in @member
    patch "/api/groups/#{@group.slug}", params: { group: { sub_requests_audience: "off" } }, as: :json
    assert_response :forbidden
    sign_in @admin
    patch "/api/groups/#{@group.slug}", params: { group: { sub_requests_audience: "hosts" } }, as: :json
    assert_response :success
    assert_equal "hosts", response.parsed_body["sub_requests_audience"]
    patch "/api/groups/#{@group.slug}", params: { group: { sub_requests_audience: "everyone" } }, as: :json
    assert_response :unprocessable_entity
  end

  test "members can't call off someone else's request" do
    sign_in @coordinator
    ask
    id = response.parsed_body["sub_requests"].sole["id"]
    sign_in @member
    delete sub_path(id), as: :json
    assert_response :forbidden
  end
end
