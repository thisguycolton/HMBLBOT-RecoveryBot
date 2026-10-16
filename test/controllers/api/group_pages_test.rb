require "test_helper"

class Api::GroupPagesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @boss = User.create!(email: "boss@example.com", name: "Boss", password: "password123", confirmed: true, admin: true)
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @other = User.create!(email: "other@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @member, role: "member")
    @elsewhere = Group.create!(title: "Night Owls", time_zone: "America/Phoenix")
    @elsewhere.memberships.create!(user: @other, role: "member")
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  test "a group shows the default page until its admins save their own" do
    sign_in @member
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_response :success
    body = response.parsed_body
    assert_equal false, body["custom"]
    assert_equal false, body["can_edit"]
    assert_equal GroupPageTemplate.current.blocks.map { |b| b["type"] }, body["blocks"].map { |b| b["type"] }

    patch "/api/groups/#{@group.slug}/page", params: { page: { blocks: [] } }, as: :json
    assert_response :forbidden

    sign_in @leader
    blocks = [{ type: "heading", text: "Hi {{group}}", color: "emerald" }, { type: "timeline", region: "side", color: "neon" }, { type: "poll" }]
    patch "/api/groups/#{@group.slug}/page", params: { page: { layout: "centered", blocks: blocks } }, as: :json
    assert_response :success
    @group.reload
    assert @group.custom_page?
    assert_equal "centered", @group.page_layout
    # poll is an event block; unknown colors fall back to the default look
    assert_equal %w[heading timeline], @group.page_blocks.map { |b| b["type"] }
    assert_equal %w[emerald default], @group.page_blocks.map { |b| b["color"] }

    patch "/api/groups/#{@group.slug}/page", params: { page: { reset: true } }, as: :json
    assert_response :success
    assert_not @group.reload.custom_page?
  end

  test "event blocks keep a color too" do
    event = @group.events.create!(title: "Workshop", time_zone: "America/Phoenix", blocks: [{ type: "notes", markdown: "Hi", color: "amber" }, { type: "agenda", color: "bogus" }])
    assert_equal %w[amber default], event.blocks.map { |b| b["color"] }
  end

  test "only site admins change the default page" do
    sign_in @leader
    get "/api/group_page_template", as: :json
    assert_response :forbidden # Groups is still admin-only
    patch "/api/group_page_template", params: { page: { blocks: [] } }, as: :json
    assert_response :forbidden

    sign_in @boss
    patch "/api/group_page_template", params: { page: { blocks: [{ type: "join", markdown: "Come on in" }] } }, as: :json
    assert_response :success
    assert_equal ["join"], GroupPageTemplate.current.blocks.map { |b| b["type"] }
    assert_equal @boss, GroupPageTemplate.current.updated_by
  end

  test "members see notes shared to the group; a note shares only to its author's groups" do
    sign_in @member
    post "/api/timeline_notes", params: { note: { body: "90 days", group_slugs: [@group.slug, @elsewhere.slug] } }, as: :json
    assert_response :created
    note = TimelineNote.find(response.parsed_body["id"])
    assert_equal [@group], note.groups.to_a

    post "/api/timeline_notes", params: { note: { body: "Just mine" } }, as: :json
    assert_response :created

    sign_in @leader
    get "/api/groups/#{@group.slug}/page", as: :json
    timeline = response.parsed_body.dig("context", "timeline")
    assert_equal ["90 days"], timeline.map { |n| n["body"] }
    assert timeline.first["can_remove"]

    sign_in @boss
    @group.memberships.find_by(user: @member).destroy!
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_empty response.parsed_body.dig("context", "timeline"), "a note leaves with its author"
  end

  test "people outside the group don't see its notes or members, and group admins can take a note down" do
    note = @member.timeline_notes.create!(body: "Hello")
    note.share_to!([@group])

    sign_in @boss
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_equal 1, response.parsed_body.dig("context", "timeline").size, "site admins see everything"

    ENV["GROUPS_FOR_EVERYONE"] = "1"
    sign_in @other
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_response :success
    assert_nil response.parsed_body.dig("context", "timeline")
    assert_nil response.parsed_body.dig("context", "members")
    assert_equal 2, response.parsed_body.dig("context", "group", "members_count")
    delete "/api/groups/#{@group.slug}/page/timeline/#{note.id}", as: :json
    assert_response :forbidden

    sign_in @leader
    delete "/api/groups/#{@group.slug}/page/timeline/#{note.id}", as: :json
    assert_response :no_content
    assert note.reload.groups.empty?, "it stays on its author's own timeline"
  ensure
    ENV.delete("GROUPS_FOR_EVERYONE")
  end

  test "people only change their own notes" do
    note = @member.timeline_notes.create!(body: "Hello")
    sign_in @other
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    patch "/api/timeline_notes/#{note.id}", params: { note: { body: "Hacked" } }, as: :json
    assert_response :not_found
    sign_in @member
    patch "/api/timeline_notes/#{note.id}", params: { note: { body: "Hello again", group_slugs: [@group.slug] } }, as: :json
    assert_response :success
    assert_equal "Hello again", note.reload.body
    assert_equal [@group], note.groups.to_a
  ensure
    ENV.delete("GROUPS_FOR_EVERYONE")
  end

  test "an AA Intergroup group that isn't here shows the default page with its meetings" do
    now = Time.current
    OiaaMeeting.create!(slug: "desert-dawn", name: "Desert Dawn", group_name: "Desert Dawn Group", days: [1, 3], start_time: "07:00", time_zone: "America/Phoenix", last_seen_at: now)
    OiaaMeeting.create!(slug: "desert-dawn-sat", name: "Desert Dawn Speaker", group_name: "Desert Dawn Group", days: [6], start_time: "09:00", time_zone: "America/Phoenix", last_seen_at: now)

    sign_in @boss
    get "/api/intergroup_pages/desert-dawn", as: :json
    assert_response :success
    body = response.parsed_body
    assert_equal "intergroup", body["kind"]
    assert_equal "Desert Dawn Group", body.dig("context", "group", "title")
    assert_equal 2, body.dig("context", "meetings").size

    here = Group.create!(title: "Desert Dawn Group", time_zone: "America/Phoenix")
    get "/api/intergroup_pages/desert-dawn", as: :json
    assert_equal here.slug, response.parsed_body["group_slug"]
  end

  test "groups can't take the Groups app's own paths as names" do
    assert_equal "find-2", Group.create!(title: "Find").slug
    assert_not Group.new(title: "X", slug: "timeline").valid?
  end
end
