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

  test "record keepers download every motion as a decisions file" do
    get path("export"), as: :json
    assert_response :unauthorized

    sign_in @member
    get path("export")
    assert_response :forbidden

    sign_in @keeper
    get path("export")
    assert_response :success
    assert_match "attachment", response.headers["Content-Disposition"]
    data = JSON.parse(response.body)
    assert_equal ["recoverybot-decisions", 1], data.values_at("format", "version")
    assert_equal ["This meeting is closed", "Send 7th Tradition 60/30/10", "Add a second meeting"], data["decisions"].map { |d| d["title"] }
    assert_equal [@closed.id, "2025-01-05", 11, "public"], data["decisions"].first.values_at("id", "decided_on", "votes_for", "visibility")
  end

  test "importing a decisions file shows the changes first, then saves all of them" do
    meeting = @group.business_meetings.create!(held_on: Date.new(2024, 8, 18), status: "held")
    sign_in @keeper
    get path("export")
    data = JSON.parse(response.body)
    data["decisions"].find { |d| d["id"] == @closed.id }["title"] = "This meeting is closed to visitors"
    data["decisions"] << { "ref" => "amend1", "title" => "Amend the closed rule", "kind" => "amend", "parent_id" => @closed.id, "status" => "tabled", "meeting" => "2024-08-18" }
    data["decisions"] << { "ref" => "accept", "title" => "Accept the treasurer's report", "kind" => "accept_report", "status" => "passed", "meeting" => "2024-08-18", "moved_by" => "Kim B" }
    data["decisions"] << { "title" => "Open to visitors", "status" => "passed", "decided_on" => "2026-06-01", "supersedes_id" => @closed.id.to_s }

    post path("import"), params: { file: data.to_json, dry_run: true }, as: :json
    assert_response :success
    body = response.parsed_body
    assert body["ok"], body.inspect
    assert_not body["saved"]
    assert_equal({ "create" => 3, "update" => 1, "delete" => 0, "unchanged" => 2 }, body["summary"])
    assert_equal ["This meeting is closed", "This meeting is closed to visitors"], body["rows"].first["changes"]["title"]
    assert_equal "This meeting is closed", @closed.reload.title, "a preview saves nothing"
    assert_equal 3, @group.motions.count

    post path("import"), params: { file: data.to_json, dry_run: false }, as: :json
    assert response.parsed_body["saved"]
    assert_equal "This meeting is closed to visitors", @closed.reload.title
    amend = @group.motions.find_by!(title: "Amend the closed rule")
    assert_equal [@closed.id, meeting.id, Date.new(2024, 8, 18), true], [amend.parent_id, amend.business_meeting_id, amend.decided_on, amend.imported]
    assert_not @group.motions.find_by!(title: "Accept the treasurer's report").decision?, "routine approvals stay out of the log"
    assert_equal @closed.id, @group.motions.find_by!(title: "Open to visitors").supersedes_id
    assert_not_includes @group.motions.standing.pluck(:id), @closed.id
  end

  test "a new decision can point at another new one by its ref" do
    sign_in @keeper
    file = { format: "recoverybot-decisions", version: 1, decisions: [
      { ref: "a", title: "Amend it", kind: "amend", parent_id: "b", status: "proposed" },
      { ref: "b", title: "Ban political artifacts", status: "passed", decided_on: "2024-06-16" },
    ] }
    post path("import"), params: { file: file.to_json, dry_run: false }, as: :json
    assert response.parsed_body["saved"], response.parsed_body.inspect
    assert_equal @group.motions.find_by!(title: "Ban political artifacts").id, @group.motions.find_by!(title: "Amend it").parent_id
  end

  test "one problem in the file saves nothing, and says where" do
    sign_in @keeper
    file = { format: "recoverybot-decisions", version: 1, decisions: [
      { id: @money.id, title: "Send it 50/50" },
      { id: 999_999, title: "Ghost" },
      { title: "No meeting", status: "passed", decided_on: "2024-01-01", meeting: "2024-01-01" },
      { id: @failed.id, delete: true },
    ] }
    post path("import"), params: { file: file.to_json, dry_run: false }, as: :json
    body = response.parsed_body
    assert_not body["ok"]
    assert_not body["saved"]
    errors = body["rows"].to_h { |r| [r["index"], r["errors"]] }
    assert_match "no decision 999999", errors[1].join
    assert_match "no business meeting", errors[2].join
    assert_match "admins", errors[3].join
    assert_equal "Send 7th Tradition 60/30/10", @money.reload.title
    assert @group.motions.exists?(@failed.id)
  end

  test "group admins can delete decisions from a file; a file that isn't one is refused" do
    sign_in @leader
    post path("import"), params: { file: { format: "recoverybot-decisions", version: 1, decisions: [{ id: @failed.id, delete: true }] }.to_json, dry_run: false }, as: :json
    assert response.parsed_body["saved"]
    assert_not @group.motions.exists?(@failed.id)

    post path("import"), params: { file: "{nope" }, as: :json
    assert_response :unprocessable_entity
    post path("import"), params: { file: { format: "recoverybot-document" }.to_json }, as: :json
    assert_match "isn't a RecoveryBot decisions file", response.parsed_body["error"]
  end
end
