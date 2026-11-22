require "test_helper"

# Sharing a decision by link (Motion#share!), its public page (/d/:token), and citing decisions
# in document comments (DecisionRefs)
class DecisionSharesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []
  BROWSER = { "User-Agent" => "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" }.freeze

  setup do
    Rails.application.reload_routes_unless_loaded
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @money = @group.motions.create!(title: "Send 7th Tradition 60/30/10", text: "Split it **60/30/10**", category: "money", status: "passed",
                                    decided_on: Date.new(2026, 3, 3), votes_for: 9, votes_against: 2, moved_by_name: "Jane D.", seconded_by_name: "Bob K.",
                                    minority_opinion: "Sam R. wanted 50/50", note: "Ask Pat M. about it")
  end

  def share_path(m = @money) = "/api/groups/#{@group.slug}/motions/#{m.id}/share"

  test "only record keepers share a decision, and turning it off kills the link" do
    sign_in @member
    post share_path, as: :json
    assert_response :forbidden

    sign_in @keeper
    post share_path, as: :json
    assert_response :success
    link = response.parsed_body.dig("share", "path")
    assert_match %r{\A/d/[A-Za-z0-9_-]{20,}\z}, link
    assert_equal @keeper, @money.reload.shared_by

    post share_path, as: :json
    assert_equal link, response.parsed_body.dig("share", "path"), "sharing again keeps the link"

    sign_out @keeper
    get link, headers: BROWSER
    assert_response :success
    assert_includes response.body, "Send 7th Tradition 60/30/10"
    assert_includes response.headers["X-Robots-Tag"], "noindex"
    %w[Jane Bob Pat].each { |name| assert_not_includes response.body, name }
    assert_includes response.body, "Sam R. wanted 50/50", "the minority opinion shows unless the group turns it off"

    sign_in @keeper
    delete share_path, as: :json
    assert_response :success
    assert_nil response.parsed_body["share"]
    sign_out @keeper
    get link, headers: BROWSER
    assert_response :not_found

    sign_in @keeper
    post share_path, as: :json
    assert_not_equal link, response.parsed_body.dig("share", "path"), "sharing again makes a new link"
  end

  test "Group settings decide who shares: officers by default, members or admins if the group picks" do
    treasurer = User.create!(email: "t@example.com", name: "Tess", password: "password123", confirmed: true)
    gsr = User.create!(email: "g@example.com", name: "Gus", password: "password123", confirmed: true)
    @group.memberships.create!(user: treasurer, role: "member", can_keep_treasury: true)
    @group.memberships.create!(user: gsr, role: "member")
    office = @group.service_positions.create!(title: "GSR")
    office.terms.create!(user: gsr, name: "Gus G.", starts_on: Date.new(2026, 1, 1))

    [treasurer, gsr].each do |officer|
      sign_in officer
      post share_path, as: :json
      assert_response :success, "#{officer.name} holds an elected role"
    end
    sign_in @member
    post share_path, as: :json
    assert_response :forbidden
    get "/api/groups/#{@group.slug}/motions", as: :json
    assert_equal false, response.parsed_body["can_share"]

    @group.update!(decision_sharers: "members")
    post share_path, as: :json
    assert_response :success
    assert response.parsed_body["share"], "a member who may share sees the link"

    @group.update!(decision_sharers: "admins")
    sign_in @keeper
    delete share_path, as: :json
    assert_response :forbidden
    sign_in @leader
    delete share_path, as: :json
    assert_response :success
  end

  test "Group settings decide what the page shows" do
    @money.share!(@keeper)
    @group.update!(decision_share_fields: %w[moved_by])
    json = @money.reload.public_json
    assert_equal "", json[:text]
    assert_equal "", json[:minority_opinion]
    assert_nil json[:votes_for]
    assert_nil json[:group]
    assert_equal "Jane D.", json[:moved_by]
    get @money.share_path, headers: BROWSER
    assert_not_includes response.body, "Sam R."
    assert_not_includes response.body, "Pat M.", "the note never shows"
    assert_includes response.body, "Jane D."
    @group.update!(decision_share_fields: %w[bogus text])
    assert_equal %w[text], @group.reload.decision_share_fields
  end

  test "members don't see the link, records to check can't be shared" do
    @money.share!(@keeper)
    sign_in @member
    get "/api/groups/#{@group.slug}/motions", as: :json
    assert_nil response.parsed_body["motions"].first["share"]

    @money.update!(needs_review: true)
    sign_in @keeper
    post share_path, as: :json
    assert_response :unprocessable_entity
    get @money.share_path, headers: BROWSER
    assert_response :not_found
  end

  test "link preview apps get the title, other robots are turned away" do
    @money.share!(@keeper)
    get @money.share_path, headers: { "User-Agent" => "facebookexternalhit/1.1" }
    assert_response :success
    assert_includes response.body, %(og:title" content="Send 7th Tradition 60/30/10)
    assert_includes response.body, "Passed on March 3, 2026 · 9 for, 2 against"
    get @money.share_path, headers: { "User-Agent" => "Googlebot/2.1" }
    assert_response :forbidden
  end

  test "the public page names the group only when its page is open to visitors" do
    @money.share!(@keeper)
    hidden = !@group.page_visible_to?(nil)
    get @money.share_path, headers: BROWSER
    assert_equal hidden, !response.body.include?("Sunrise Crew")
  end

  test "comments cite decisions, showing each viewer only what they may see" do
    secret = @group.motions.create!(title: "Keepers-only plan", status: "passed", decided_on: Date.new(2026, 1, 1), needs_review: true)
    other = Group.create!(title: "Night Owls", time_zone: "America/Phoenix")
    theirs = other.motions.create!(title: "Night Owls rule", status: "passed", decided_on: Date.new(2026, 2, 2))
    theirs.share!(nil)
    doc = @group.documents.new(created_by: @keeper)
    doc.revise({ title: "Format", body: "<p>Read the preamble, then the steps.</p>", visibility: "members" }, @keeper)
    doc.update!(comment_mode: "members")

    sign_in @keeper
    body = "See [[decision:#{@money.id}]] and [[decision:#{secret.id}]] and https://example.com#{theirs.share_path} and [[decision:999999]]"
    post "/api/groups/#{@group.slug}/documents/#{doc.id}/comments", params: { body: body, quote: "the preamble" }, as: :json
    assert_response :created
    cards = response.parsed_body["decisions"]
    assert_equal "member", cards["decision:#{@money.id}"]["access"]
    assert_equal "member", cards["decision:#{secret.id}"]["access"], "keepers see records still to check"
    assert_equal "public", cards["link:#{theirs.share_token}"]["access"]
    assert_equal "Night Owls rule", cards["link:#{theirs.share_token}"]["title"]
    assert_equal({ "access" => "none" }, cards["decision:999999"])

    sign_in @member
    get "/api/groups/#{@group.slug}/documents/#{doc.id}/comments", as: :json
    cards = response.parsed_body["comments"].first["decisions"]
    assert_equal "Send 7th Tradition 60/30/10", cards["decision:#{@money.id}"]["title"]
    assert_equal({ "access" => "none" }, cards["decision:#{secret.id}"], "a decision they can't see shows no title")
    assert_equal "/d/#{theirs.share_token}", cards["link:#{theirs.share_token}"]["url"]
  end
end
