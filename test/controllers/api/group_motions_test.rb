require "test_helper"

class Api::GroupMotionsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @boss = User.create!(email: "boss@example.com", name: "Boss", password: "password123", confirmed: true, admin: true)
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @other = User.create!(email: "other@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @elsewhere = Group.create!(title: "Night Owls", time_zone: "America/Phoenix")
    @elsewhere.memberships.create!(user: @other, role: "member")

    @closed = @group.motions.create!(title: "This meeting is closed", category: "meeting", status: "passed", decided_on: Date.new(2025, 1, 5), visibility: "public", votes_for: 11, votes_against: 2, abstentions: 1)
    @money = @group.motions.create!(title: "Send 7th Tradition 60/30/10", text: "Split it **60/30/10**", category: "money", status: "passed", decided_on: Date.new(2026, 3, 3), votes_for: 9)
    @failed = @group.motions.create!(title: "Add a second meeting", category: "meeting", status: "failed", decided_on: Date.new(2026, 4, 7), minority_opinion: "We have no room.")
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def titles = response.parsed_body["motions"].map { |m| m["title"] }
  def path(*rest) = ["/api/groups/#{@group.slug}/motions", *rest].join("/")

  test "visitors and non-members only see Public decisions that passed" do
    get path, as: :json
    assert_response :success
    assert_equal ["This meeting is closed"], titles
    assert_equal false, response.parsed_body["can_edit"]

    sign_in @other
    get path, as: :json
    assert_equal ["This meeting is closed"], titles
  end

  test "members see Members decisions too, newest first, with counts and standing" do
    sign_in @member
    get path, as: :json
    assert_equal ["Add a second meeting", "Send 7th Tradition 60/30/10", "This meeting is closed"], titles
    money = response.parsed_body["motions"].find { |m| m["title"].start_with?("Send") }
    assert_equal [9, nil, nil, true], money.values_at("votes_for", "votes_against", "abstentions", "standing")
    failed = response.parsed_body["motions"].first
    assert_equal ["failed", false, "We have no room."], failed.values_at("status", "standing", "minority_opinion")
  end

  test "a replaced decision shows what replaced it, but not a title the viewer can't see" do
    @group.motions.create!(title: "Now we are open", category: "meeting", status: "passed", decided_on: Date.new(2026, 5, 1), supersedes: @closed)

    sign_in @member
    get path, as: :json
    closed = response.parsed_body["motions"].find { |m| m["title"] == "This meeting is closed" }
    assert_equal false, closed["standing"]
    assert_equal "Now we are open", closed["replaced_by"]["title"]

    sign_out @member
    get path, as: :json
    closed = response.parsed_body["motions"].first
    assert_equal ["This meeting is closed", false], closed.values_at("title", "standing")
    assert_nil closed["replaced_by"]["title"], "the replacement is members-only"
    assert_equal "2026-05-01", closed["replaced_by"]["decided_on"]
  end

  test "search covers titles and wording" do
    sign_in @member
    get path, params: { q: "60/30" }, as: :json
    assert_equal ["Send 7th Tradition 60/30/10"], titles
  end

  test "only record keepers write decisions" do
    post path, params: { motion: { title: "Nope" } }, as: :json
    assert_response :unauthorized

    sign_in @member
    post path, params: { motion: { title: "Nope", status: "proposed" } }, as: :json
    assert_response :forbidden
    patch path(@money.id), params: { motion: { title: "Changed" } }, as: :json
    assert_response :forbidden

    sign_in @keeper
    post path, params: { motion: { title: "Buy a new coffee urn", text: "Up to $40", category: "other", status: "passed", decided_on: "2026-06-02",
                                   moved_by_name: "Kay K.", seconded_by_name: "Mo M.", votes_for: 8, votes_against: 1, abstentions: "", supersedes_id: @money.id } }, as: :json
    assert_response :created
    body = response.parsed_body
    assert_equal [@keeper, nil, "members"], [Motion.find(body["id"]).created_by, Motion.find(body["id"]).abstentions, body["visibility"]]
    assert_equal @money.id, body["replaces"]["id"]

    patch path(@money.id), params: { motion: { minority_opinion: "Give more to the district" } }, as: :json
    assert_response :success
    assert_equal false, response.parsed_body["standing"], "the new decision replaced it"

    post path, params: { motion: { title: "", status: "passed" } }, as: :json
    assert_response :unprocessable_entity
    post path, params: { motion: { title: "Undated", status: "passed" } }, as: :json
    assert_response :unprocessable_entity
    patch path(@money.id), params: { motion: { supersedes_id: Motion.last.id } }, as: :json
    assert_response :unprocessable_entity
  end

  test "a record keeper of another group can't touch this one" do
    sign_in @other
    post path, params: { motion: { title: "Nope", status: "proposed" } }, as: :json
    assert_response :not_found
  end

  test "only group admins delete a decision" do
    sign_in @keeper
    delete path(@failed.id), as: :json
    assert_response :forbidden

    sign_in @leader
    delete path(@failed.id), as: :json
    assert_response :no_content
    assert_not Motion.exists?(@failed.id)
  end

  test "a document links to the decision that adopted it, only where the viewer may see that decision" do
    doc = @group.documents.create!(title: "Guidelines", kind: "guidelines", visibility: "public", approved_by: @money)
    sign_in @keeper
    get "/api/groups/#{@group.slug}/documents/#{doc.id}", as: :json
    assert_equal "Send 7th Tradition 60/30/10", response.parsed_body.dig("approved_by", "title")

    sign_out @keeper
    get "/api/groups/#{@group.slug}/documents/#{doc.id}", as: :json
    assert_nil response.parsed_body["approved_by"], "the decision is members-only"

    sign_in @keeper
    patch "/api/groups/#{@group.slug}/documents/#{doc.id}", params: { document: { approved_by_motion_id: @failed.id } }, as: :json
    assert_response :unprocessable_entity
    patch "/api/groups/#{@group.slug}/documents/#{doc.id}", params: { document: { approved_by_motion_id: @closed.id } }, as: :json
    assert_response :success
    assert_equal 0, doc.versions.count, "adopting a document isn't a new copy of it"
    patch "/api/groups/#{@group.slug}/documents/#{doc.id}", params: { document: { approved_by_motion_id: "" } }, as: :json
    assert_nil doc.reload.approved_by_motion_id
  end

  test "the page's decisions block lists standing decisions the viewer may see" do
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_equal ["This meeting is closed"], response.parsed_body.dig("context", "decisions").map { |d| d["title"] }

    sign_in @member
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_equal ["Send 7th Tradition 60/30/10", "This meeting is closed"], response.parsed_body.dig("context", "decisions").map { |d| d["title"] }

    sign_in @leader
    patch "/api/groups/#{@group.slug}/page", params: { page: { blocks: [{ type: "decisions", category: "money", limit: 3 }, { type: "decisions", category: "bogus", limit: 99 }] } }, as: :json
    assert_response :success
    assert_equal [["money", 3], ["all", 5]], @group.reload.page_blocks.map { |b| [b["category"], b["limit"]] }
  end
end
