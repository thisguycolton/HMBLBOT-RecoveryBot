require "test_helper"

# HostDeck's decks of their own (Deck, DeckCenter, Api::DecksController): made from a document,
# run by the group's members with blocks that keep their state on the deck's session
class Api::DecksTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @keeper = User.create!(email: "keeper@example.com", name: "Kit", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @outsider = User.create!(email: "out@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @doc = @group.documents.create!(title: "Business meeting agenda", kind: "format", body: "## Old business\n\n## New business", visibility: "members")
    @meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: @group.zone.today.wday, start_minute: 420)
  end

  def path(*rest) = ["/api/groups/#{@group.slug}/decks", *rest].join("/")

  ARRANGEMENT = { layout: "right", right: [{ id: "list", type: "checklist", settings: { title: "Before we start", items: [{ id: "a", text: "Open with the Serenity Prayer" }] } }],
                  bar: [{ id: "timer-1", type: "timer", grow: true, settings: { title: "Reports", minutes: 500 } }] }.freeze

  test "the members the group picked make decks from a document; the rest of the group runs them" do
    sign_in @member
    post path, params: { deck: { name: "Business meeting", purpose: "business", script_document_id: @doc.id } }, as: :json
    assert_response :forbidden

    sign_in @keeper
    post path, params: { deck: { name: "Business meeting", purpose: "business", script_document_id: @doc.id } }, as: :json
    assert_response :created
    deck = @group.decks.find(response.parsed_body["id"])
    assert_equal @doc, deck.script_document

    get path, params: { document_id: @doc.id }, as: :json
    assert_equal [deck.id], response.parsed_body["decks"].map { |d| d["id"] }

    put path(deck.id, "arrangement"), params: { arrangement: ARRANGEMENT }, as: :json
    assert_response :success
    saved = deck.reload.arrangement
    assert_equal({ "title" => "Reports", "minutes" => 180 }, saved["bar"].first["settings"])
    assert_equal "stage", saved["main"].first["type"]

    sign_in @member
    get path(deck.id), as: :json
    assert_response :success
    assert_not response.parsed_body["can_arrange"]
    put path(deck.id, "arrangement"), params: { arrangement: ARRANGEMENT }, as: :json
    assert_response :forbidden

    sign_in @outsider
    get path(deck.id), as: :json
    assert_includes [403, 404], response.status
  end

  test "the list names each deck's document, unless it's one this person can't see" do
    hidden = @group.documents.create!(title: "Keepers' notes", kind: "other", body: "x", visibility: "keepers")
    a = @group.decks.create!(name: "Business", purpose: "business_meeting", script_document: @doc)
    b = @group.decks.create!(name: "Onboarding", purpose: "onboarding", script_document: hidden)

    sign_in @member
    get path, as: :json
    titles = response.parsed_body["decks"].to_h { |d| [d["id"], d.dig("script_document", "title")] }
    assert_equal({ a.id => "Business meeting agenda", b.id => nil }, titles)
    assert_not response.parsed_body["can_host"], "meeting scripts are only offered to people who can host"

    sign_in @keeper
    get path, as: :json
    assert_equal "Keepers' notes", response.parsed_body["decks"].find { |d| d["id"] == b.id }.dig("script_document", "title")
  end

  test "a deck's checklist, timer and clock are shared on its session, and only a deck's acts are allowed" do
    deck = @group.decks.create!(name: "Onboarding", purpose: "onboarding", script_document: @doc, created_by: @keeper, arrangement: ARRANGEMENT)
    sign_in @member

    post path(deck.id, "act"), params: { act: "block", label: "Open with the Serenity Prayer", data: { block_id: "list", op: "toggle", item: "a" } }, as: :json
    assert_response :success
    assert_equal "Mo", response.parsed_body.dig("block_state", "list", "done", "a", "by")

    post path(deck.id, "act"), params: { act: "block", data: { block_id: "timer-1", op: "timer_start" } }, as: :json
    assert response.parsed_body.dig("block_state", "timer-1", "started_at")
    post path(deck.id, "act"), params: { act: "block", data: { block_id: "timer-1", op: "timer_pause" } }, as: :json
    timer = response.parsed_body.dig("block_state", "timer-1")
    assert_nil timer["started_at"]
    assert timer["banked"] >= 0

    post path(deck.id, "act"), params: { act: "clock_start" }, as: :json
    assert response.parsed_body["clock_started_at"]
    # a deck has milestones too (its Milestones form block), but no reading / activity
    post path(deck.id, "act"), params: { act: "milestone_add", data: { name: "Kim", length: "30 days" } }, as: :json
    assert_response :success
    kim = response.parsed_body["milestones"].sole
    assert_equal ["Kim", "30 days"], kim.values_at("name", "length")
    post path(deck.id, "act"), params: { act: "milestone_update", data: { id: kim["id"], done: true } }, as: :json
    assert response.parsed_body["milestones"].sole["done"]
    post path(deck.id, "act"), params: { act: "activity", activity: { kind: "other", title: "Hi" } }, as: :json
    assert_response :unprocessable_entity

    session = deck.sessions.sole
    assert_nil session.meeting_id
    assert_includes session.log.map { |l| l["text"] }, "Checked off Open with the Serenity Prayer"

    post path(deck.id, "act"), params: { act: "block", data: { block_id: "list", op: "toggle", item: "a" } }, as: :json
    assert_empty response.parsed_body.dig("block_state", "list", "done")

    assert_raises(ActiveRecord::RecordInvalid) { HostingSession.create!(meeting: @meeting, deck: deck, on: Date.current) }
  end

  test "Reset takes a deck back to its first section with nothing ticked off, and keeps what was filled in" do
    deck = @group.decks.create!(name: "Onboarding", purpose: "onboarding", script_document: @doc, created_by: @keeper, arrangement: ARRANGEMENT)
    sign_in @member
    post path(deck.id, "act"), params: { act: "complete", index: 0, label: "Old business" }, as: :json
    post path(deck.id, "act"), params: { act: "goto", index: 1, label: "New business" }, as: :json
    post path(deck.id, "act"), params: { act: "milestone_add", data: { name: "Kim" } }, as: :json
    post path(deck.id, "act"), params: { act: "reset", index: 0, label: "Old business" }, as: :json
    assert_response :success
    live = response.parsed_body
    assert_equal 0, live["section_index"]
    assert_empty live["completed"]
    assert_equal ["Kim"], live["milestones"].map { |m| m["name"] }
    assert_equal "Reset the deck to Old business", live["log"].first["text"]
  end

  test "a deck names what comes before its document's first section" do
    deck = @group.decks.create!(name: "Onboarding", purpose: "onboarding", script_document: @doc, created_by: @keeper)
    sign_in @keeper
    patch path(deck.id), params: { deck: { intro_title: "  Setting   up  " } }, as: :json
    assert_response :success
    assert_equal "Setting up", response.parsed_body.dig("kit", "intro_title")
    assert_equal "Setting up", response.parsed_body.dig("deck", "intro_title")
    patch path(deck.id), params: { deck: { intro_title: "" } }, as: :json
    assert_nil deck.reload.intro_title
  end

  test "a document becomes a meeting's script from the File menu" do
    coordinator = User.create!(email: "coord@example.com", name: "Cam", password: "password123", confirmed: true)
    @group.memberships.create!(user: coordinator, role: "member", can_schedule_hosts: true)
    sign_in coordinator
    put "/api/groups/#{@group.slug}/hosting/#{@meeting.id}/script", params: { scope: "meeting", document_id: @doc.id }, as: :json
    assert_response :success
    assert_equal @doc, @group.hosting_kits.find_by(meeting: @meeting).script_document

    sign_in @member
    put "/api/groups/#{@group.slug}/hosting/#{@meeting.id}/script", params: { scope: "default", document_id: @doc.id }, as: :json
    assert_response :forbidden
  end
end
