require "test_helper"

class Api::GroupServiceAndTreasuryTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @other = User.create!(email: "other@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    Group.create!(title: "Night Owls", time_zone: "America/Phoenix").memberships.create!(user: @other, role: "member")
    @today = @group.zone.today
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def body = response.parsed_body
  def positions(*rest) = ["/api/groups/#{@group.slug}/service_positions", *rest].join("/")
  def reports(*rest) = ["/api/groups/#{@group.slug}/treasurer_reports", *rest].join("/")

  test "members read service positions; record keepers change them" do
    get positions, as: :json
    assert_response :unauthorized
    sign_in @other
    get positions, as: :json
    assert_response :not_found

    sign_in @member
    post positions, params: { service_position: { title: "Treasurer" } }, as: :json
    assert_response :forbidden
    get positions, as: :json
    assert_equal [false, []], [body["can_edit"], body["members"]]

    sign_in @keeper
    post positions, params: { service_position: { title: " Treasurer ", description: "Counts the basket", term_months: 12, sobriety_months: 12 } }, as: :json
    assert_response :created
    id = body["id"]
    assert_equal ["Treasurer", "vacant"], body.values_at("title", "rotation")
    post positions, params: { service_position: { title: "" } }, as: :json
    assert_response :unprocessable_entity
    patch positions(id), params: { service_position: { term_months: 6 } }, as: :json
    assert_equal 6, body["term_months"]
    get positions, as: :json
    assert_equal [true, ["Kay", "Lee", "Mo"]], [body["can_edit"], body["members"].map { |m| m["name"] }]
  end

  test "putting someone in a position ends the term before it" do
    position = @group.service_positions.create!(title: "Chair", term_months: 6)
    sign_in @keeper
    post positions(position.id, "terms"), params: { term: { name: "Mo M.", user_id: @member.id, starts_on: (@today - 100).to_s } }, as: :json
    assert_response :created
    assert_equal "Mo M.", body.dig("current", "name")

    post positions(position.id, "terms"), params: { term: { name: "Kay K.", user_id: @other.id, starts_on: @today.to_s } }, as: :json
    assert_response :created
    assert_equal ["Kay K.", false], [body.dig("current", "name"), body.dig("current", "linked")], "someone outside the group isn't linked"
    assert_equal [(@today - 1).iso8601], body["history"].map { |t| t["ends_on"] }
    assert_nil body["rotation"]

    term_id = body["current"]["id"]
    patch positions(position.id, "terms", term_id), params: { term: { ends_on: (@today + 5).to_s } }, as: :json
    assert_equal "due", body["rotation"]
    post positions(position.id, "terms"), params: { term: { name: "", starts_on: @today.to_s } }, as: :json
    assert_response :unprocessable_entity
    delete positions(position.id, "terms", term_id), as: :json
    assert_equal ["Mo M."], body["history"].map { |t| t["name"] }

    sign_in @member
    post positions(position.id, "terms"), params: { term: { name: "Me", starts_on: @today.to_s } }, as: :json
    assert_response :forbidden
  end

  test "opening the list sends due reminders" do
    position = @group.service_positions.create!(title: "Secretary")
    position.terms.create!(name: "Mo M.", user: @member, starts_on: @today - 300, ends_on: @today + 12)
    sign_in @member
    assert_difference -> { Notification.count } => 3 do # Lee and Kay, and Mo whose term it is
      get positions, as: :json
    end
    assert_equal "due", body["positions"].first["rotation"]
    assert_no_difference -> { Notification.count } do
      get positions, as: :json
    end
  end

  test "a member an admin makes treasurer writes and posts reports, and sees drafts" do
    treasurer = User.create!(email: "treasurer@example.com", name: "Tess", password: "password123", confirmed: true)
    membership = @group.memberships.create!(user: treasurer, role: "member")
    sign_in treasurer
    post reports, params: { treasurer_report: { period_on: "2026-08-01" } }, as: :json
    assert_response :forbidden

    sign_in @member
    patch "/api/groups/#{@group.slug}/memberships/#{membership.id}", params: { can_keep_treasury: true }, as: :json
    assert_response :forbidden
    sign_in @leader
    patch "/api/groups/#{@group.slug}/memberships/#{membership.id}", params: { can_keep_treasury: true }, as: :json
    assert_response :no_content

    sign_in treasurer
    post reports, params: { treasurer_report: { period_on: "2026-08-01" } }, as: :json
    assert_response :created
    get reports, as: :json
    assert_equal [1, true, false], [body["reports"].size, body["can_edit"], body["can_delete"]]
    patch reports(body["reports"].first["id"]), params: { treasurer_report: { status: "posted" } }, as: :json
    assert_response :success
    post positions, params: { service_position: { title: "GSR" } }, as: :json
    assert_response :forbidden, "being treasurer isn't being a record keeper"
  end

  test "members read posted reports; record keepers write them; group admins delete" do
    sign_in @keeper
    post reports, params: { treasurer_report: { period_on: "2026-09-20", opening_cents: 30_000, reserve_cents: 30_000,
      lines: [{ kind: "income", label: "Seventh Tradition", cents: 14_200 }, { kind: "expense", label: "Rent", cents: 6_000 }],
      splits: [{ label: "District", percent: 30 }, { label: "Area", percent: 10 }], notes: "Good month" } }, as: :json
    assert_response :created
    id = body["id"]
    assert_equal ["2026-09-01", "draft", 8_200], [body["period_on"], body["status"], body.dig("summary", "above_reserve_cents")]
    assert_equal [["District", 2_460], ["Area", 820]], body.dig("summary", "shares").map { |s| [s["label"], s["cents"]] }

    post reports, params: { treasurer_report: { period_on: "2026-09-02" } }, as: :json
    assert_response :unprocessable_entity
    assert_match "already has a report", body["error"]

    sign_in @member
    get reports, as: :json
    assert_equal [], body["reports"], "it's still a draft"
    patch reports(id), params: { treasurer_report: { status: "posted" } }, as: :json
    assert_response :forbidden

    sign_in @keeper
    patch reports(id), params: { treasurer_report: { status: "posted" } }, as: :json
    assert_response :success
    sign_in @member
    get reports, as: :json
    assert_equal [id], body["reports"].map { |r| r["id"] }
    assert_equal [false, false], [body["can_edit"], body["can_delete"]]

    sign_in @keeper
    delete reports(id), as: :json
    assert_response :forbidden
    sign_in @leader
    delete reports(id), as: :json
    assert_response :no_content

    sign_in @other
    get reports, as: :json
    assert_response :not_found
  end
end
