require "test_helper"

class Api::GroupRobertsRulesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @today = @group.zone.today
    @meeting = @group.business_meetings.create!(held_on: @today, status: "held")
    @main = @group.motions.create!(title: "Buy a larger urn", status: "proposed", business_meeting: @meeting, moved_by_name: "Kay K.", seconded_by_name: "Mo M.")
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def body = response.parsed_body
  def motions(*rest) = ["/api/groups/#{@group.slug}/motions", *rest].join("/")

  test "the list carries the rules, and warnings only for record keepers" do
    @group.motions.create!(title: "Tie", status: "passed", decided_on: @today, votes_for: 4, votes_against: 4, seconded_by_name: "Mo M.", business_meeting: @meeting)
    sign_in @member
    get motions, as: :json
    assert_response :success
    assert_equal %w[main amend], body["kinds"].map { |k| k["key"] }.first(2)
    assert_equal "Main motion", body["groups"]["main"]
    assert_includes body["required_votes"].keys, "two_thirds"
    assert_includes body["vote_methods"].keys, "rising"
    assert_equal [[], []], [body["motions"].first["warnings"], body["motions"].last["warnings"]]

    sign_in @keeper
    get motions, as: :json
    tie = body["motions"].find { |m| m["title"] == "Tie" }
    assert_match "not a majority", tie["warnings"].join
    assert_equal "majority", tie["required"]
  end

  test "an amendment that passes changes what the main motion reads" do
    sign_in @keeper
    post motions, params: { motion: { title: "Make it larger", kind: "amend", parent_id: @main.id, status: "passed", decided_on: @today.to_s, business_meeting_id: @meeting.id,
                                      moved_by_name: "Lee L.", seconded_by_name: "Mo M.", vote_method: "voice", amended_text: "Buy a 60-cup urn" } }, as: :json
    assert_response :created
    assert_equal [@main.id, "amend", []], [body["parent_id"], body["kind"], body["warnings"]]
    assert_equal "Buy a 60-cup urn", @main.reload.amended_text
    assert_equal "proposed", @main.status, "the main motion is still before the group"
  end

  test "tabling, referring and postponing carry the main motion's agenda item forward" do
    item = @meeting.agenda_items.create!(title: "Urn")
    @main.update!(agenda_item: item)
    sign_in @keeper
    post motions, params: { motion: { title: "Table it", kind: "lay_on_table", parent_id: @main.id, status: "passed", decided_on: @today.to_s, seconded_by_name: "Mo M.", votes_for: 6, votes_against: 3 } }, as: :json
    assert_response :created
    assert_equal ["tabled", "tabled"], [@main.reload.status, item.reload.status]

    post motions, params: { motion: { title: "Refer it", kind: "commit", parent_id: @main.id, status: "passed", decided_on: @today.to_s, seconded_by_name: "Mo M.", committee: "Supplies" } }, as: :json
    assert_equal ["referred", "Supplies"], [@main.reload.status, @main.committee]
    assert_response :created
  end

  test "a record that breaks the rules is saved, with warnings" do
    sign_in @keeper
    post motions, params: { motion: { title: "Squeaker", status: "passed", decided_on: @today.to_s, votes_for: 4, votes_against: 5, business_meeting_id: @meeting.id } }, as: :json
    assert_response :created
    assert_equal ["No second is recorded.", "Recorded as passed, but 4 for and 5 against is not a majority of the votes cast (a tie is lost)."], body["warnings"]
  end

  test "the check endpoint says what the rules make of a record without saving it" do
    sign_in @member
    post motions("check"), params: { motion: { title: "X", status: "passed", votes_for: 1, votes_against: 2 } }, as: :json
    assert_response :forbidden

    sign_in @keeper
    assert_no_difference -> { Motion.count } do
      post motions("check"), params: { motion: { title: "X", status: "passed", decided_on: @today.to_s, votes_for: 5, votes_against: 5, seconded_by_name: "Mo M." } }, as: :json
    end
    assert_response :success
    assert_equal "majority", body["required"]
    assert_match "tie is lost", body["warnings"].join

    post motions("check"), params: { motion: { title: "Rescind", kind: "rescind", previous_notice: true } }, as: :json
    assert_equal "majority", body["required"]
    post motions("check"), params: { motion: { title: "Rescind", kind: "rescind", previous_notice: false } }, as: :json
    assert_equal "two_thirds", body["required"]
    post motions("check"), params: { id: @main.id, motion: { kind: "adjourn" } }, as: :json
    assert_equal "majority", body["required"]
    assert_equal "main", @main.reload.kind, "checking doesn't change it"
  end

  test "the decisions log, overview and page block leave procedure out" do
    @group.motions.create!(title: "A decision", status: "passed", decided_on: @today, seconded_by_name: "Mo M.", votes_for: 5, votes_against: 1)
    @group.motions.create!(title: "Adjourn", kind: "adjourn", status: "passed", decided_on: @today, seconded_by_name: "Mo M.", votes_for: 5, votes_against: 1)
    sign_in @member
    get "/api/groups/#{@group.slug}/conscience", as: :json
    assert_equal ["A decision"], body["recent_decisions"].map { |m| m["title"] }
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_equal ["A decision"], body.dig("context", "decisions").map { |d| d["title"] }
  end

  test "meeting times, and what's unfinished from earlier meetings, come with the meeting" do
    old = @group.motions.create!(title: "Tabled roof", status: "tabled", decided_on: @today - 20, business_meeting: @meeting)
    upcoming = @group.business_meetings.create!(held_on: @today + 10)
    sign_in @keeper
    patch "/api/groups/#{@group.slug}/business_meetings/#{@meeting.id}", params: { business_meeting: { called_to_order_time: "19:05", adjourned_time: "20:40", attendance_count: 6 } }, as: :json
    assert_response :success
    assert_equal ["19:05", "20:40"], body.values_at("called_to_order_time", "adjourned_time")

    get "/api/groups/#{@group.slug}/business_meetings/#{upcoming.id}", as: :json
    assert_equal ["Tabled roof"], body["unfinished"].map { |m| m["title"] }

    sign_in @member
    get "/api/groups/#{@group.slug}/business_meetings/#{upcoming.id}", as: :json
    assert_nil body["unfinished"], "that's for record keepers"
    assert_equal old.id, @group.motions.unfinished.first.id
  end

  test "a record keeper carries a motion onto the agenda; members can't" do
    old = @group.motions.create!(title: "Tabled roof", status: "tabled", decided_on: @today - 20, business_meeting: @meeting, committee: nil)
    upcoming = @group.business_meetings.create!(held_on: @today + 10)
    path = "/api/groups/#{@group.slug}/business_meetings/#{upcoming.id}/agenda_items"

    sign_in @member
    post path, params: { agenda_item: { title: "Sneaky", motion_id: old.id } }, as: :json
    assert_response :created
    assert_nil AgendaItem.find(body["id"]).motion_id
    assert_equal "suggested", body["status"]

    sign_in @keeper
    post path, params: { agenda_item: { title: "", motion_id: old.id, status: "on_agenda" } }, as: :json
    assert_response :created
    assert_equal ["Unfinished: Tabled roof", "old_business", old.id], body.values_at("title", "kind", "motion_id")
    assert_match(/Tabled/, body["details"])

    get "/api/groups/#{@group.slug}/business_meetings/#{upcoming.id}", as: :json
    assert_empty body["unfinished"], "it's on the agenda now"
  end

  test "an admin sets the quorum; it shows on the meeting" do
    sign_in @keeper
    patch "/api/groups/#{@group.slug}", params: { group: { quorum_count: 6 } }, as: :json
    assert_response :forbidden

    sign_in @leader
    patch "/api/groups/#{@group.slug}", params: { group: { quorum_count: 6 } }, as: :json
    assert_response :success
    assert_equal({ "count" => 6, "percent" => nil, "needed" => 6 }, body["quorum"])
    @meeting.update!(attendance_count: 5)
    get "/api/groups/#{@group.slug}/business_meetings/#{@meeting.id}", as: :json
    assert_equal [6, false], body.values_at("quorum_needed", "quorum_met")
    sign_in @keeper
    post motions, params: { motion: { title: "Do it", status: "passed", decided_on: @today.to_s, seconded_by_name: "Mo M.", votes_for: 4, votes_against: 1, business_meeting_id: @meeting.id } }, as: :json
    assert_match "no quorum", body["warnings"].join
  end
end
