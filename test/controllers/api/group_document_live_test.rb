require "test_helper"

# Live editing (GroupDocument::Live): the shared copy, the edits since, and writing it down
class Api::GroupDocumentLiveTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  include ActionCable::TestHelper

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["COLLAB_EDITING"]
    ENV["COLLAB_EDITING"] = "1"
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @doc = @group.documents.create!(title: "Format", kind: "format", body: "<p>Welcome</p>", visibility: "members", created_by: @keeper)
  end

  teardown { ENV["COLLAB_EDITING"] = @previous }

  def path = "/api/groups/#{@group.slug}/documents/#{@doc.id}/live"
  def b64(text) = Base64.strict_encode64(text)
  def json = response.parsed_body

  test "it's off without COLLAB_EDITING" do
    ENV["COLLAB_EDITING"] = nil
    sign_in @keeper
    get path, as: :json
    assert_response :not_found
    get "/api/groups/#{@group.slug}/documents/#{@doc.id}", as: :json
    assert_equal false, json["live"]
  end

  test "the first copy: only one browser's wins, and readers can't make it" do
    sign_in @member
    get path, as: :json
    assert_response :success
    assert_nil json["state"]
    assert_equal "Mo", json.dig("me", "name")
    post path, params: { start: b64("A"), epoch: 0 }, as: :json
    assert_response :forbidden

    sign_in @keeper
    assert_broadcasts(@doc.live_stream, 1) { post path, params: { start: b64("A"), epoch: 0 }, as: :json }
    assert json["started"]
    post path, params: { start: b64("B"), epoch: 0 }, as: :json
    assert_not json["started"], "a second copy would add the text twice"
    assert_equal b64("A"), json["state"]
  end

  test "edits are numbered and kept, a folded copy replaces them, and Save version makes the version" do
    @doc.live_start!("S", 0)
    assert_equal 1, @doc.live_append!("u1", @keeper, 0)
    assert_equal 2, @doc.live_append!("u2", @member, 0)
    assert_nil @doc.live_append!("u3", @keeper, 7), "an old copy's edit isn't taken"

    sign_in @member
    get path, params: { after: 1 }, as: :json
    assert_equal [2], json["updates"].map { |u| u["seq"] }

    sign_in @keeper
    post path, params: { state: b64("S+1+2"), upto: 2, epoch: 0, title: "Format v2", body: "<p>Welcome all</p><script>x</script>" }, as: :json
    assert json["ok"]
    @doc.reload
    assert_equal "S+1+2", @doc.live_state
    assert_equal "<p>Welcome all</p>", @doc.body
    assert_equal "Format v2", @doc.title
    assert_equal @keeper, @doc.updated_by
    assert_equal 0, @doc.live_updates.count
    assert_equal ["<p>Welcome</p>"], @doc.versions.map(&:body), "a document from before history keeps what it had"

    @doc.live_append!("u3", @keeper, 0)
    post path, params: { state: b64("S+1+2+3"), upto: 3, epoch: 0, title: "Format v2", body: "<p>Welcome all, again</p>" }, as: :json
    assert_equal 1, @doc.versions.count, "live edits don't make versions on their own"

    post path, params: { state: b64("old"), upto: 1, epoch: 0, title: "x", body: "<p>old</p>" }, as: :json
    assert_not json["ok"], "a copy older than the one kept is dropped"

    # Save version: the text as it stands, with the note, crediting everyone who typed
    patch "/api/groups/#{@group.slug}/documents/#{@doc.id}?checkpoint=1", params: { document: { status: "current" }, message: "Reworded the welcome" }, as: :json
    assert_response :success
    head = @doc.reload.head
    assert_equal [2, "<p>Welcome all, again</p>", "Format v2", "Reworded the welcome"], [head.number, head.body, head.title, head.message]
    assert_equal [@keeper.id, @member.id].sort, head.contributor_ids.sort
    assert_equal [false, []], [@doc.live_unversioned, @doc.live_contributor_ids]
    assert_equal 2, json["version"]

    # nothing changed since: another Save version doesn't add one
    patch "/api/groups/#{@group.slug}/documents/#{@doc.id}?checkpoint=1", params: { document: { status: "current" } }, as: :json
    assert_equal 2, @doc.versions.count
  end

  test "putting an old copy back starts everyone over" do
    @doc.live_start!("S", 0)
    @doc.live_append!("u1", @keeper, 0)
    @doc.revise({ body: "<p>Changed</p>" }, @keeper)
    assert_equal [nil, 1], [@doc.live_state, @doc.live_epoch], "a save from a tab that isn't live starts it over too"
    @doc.live_start!("S2", 1)
    version = @doc.versions.last # the first: "Welcome"
    sign_in @keeper
    assert_broadcasts(@doc.live_stream, 1) { post "/api/groups/#{@group.slug}/documents/#{@doc.id}/versions/#{version.id}/restore", as: :json }
    @doc.reload
    assert_nil @doc.live_state
    assert_equal 2, @doc.live_epoch
    assert_equal 0, @doc.live_updates.count
    assert_equal "<p>Welcome</p>", @doc.body
  end

  test "an older Markdown document becomes HTML when it starts" do
    md = @group.documents.create!(title: "Old", kind: "other", body: "**Hi**", body_format: "markdown")
    assert md.live_start!("S", 0, html: "<p><strong>Hi</strong></p>")
    assert_equal ["html", "<p><strong>Hi</strong></p>"], [md.reload.body_format, md.body]
  end
end
