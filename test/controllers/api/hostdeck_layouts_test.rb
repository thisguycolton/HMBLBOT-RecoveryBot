require "test_helper"

# HostDeck's layouts: where a meeting's blocks go (HostingLayout, DeckArrangement), for one
# meeting or the group's default, and who may rearrange them (Group#deck_editors)
class Api::HostdeckLayoutsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @admin = User.create!(email: "admin@example.com", name: "Ada", password: "password123", confirmed: true)
    @coordinator = User.create!(email: "coord@example.com", name: "Cam", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kit", password: "password123", confirmed: true)
    @host = User.create!(email: "host@example.com", name: "Hal", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @admin, role: "admin")
    @group.memberships.create!(user: @coordinator, role: "member", can_schedule_hosts: true)
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @host, role: "member", can_host: true)
    today = @group.zone.today
    @meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: today.wday, start_minute: 420)
    @other_day = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: (today.wday + 1) % 7, start_minute: 420)
    @evening = @group.meetings.create!(name: "Evening", recurrence: "weekly", day_of_week: today.wday, start_minute: 1140)
  end

  def path(*rest) = ["/api/groups/#{@group.slug}/hosting", *rest].join("/")

  RIGHT = { layout: "right", right: [{ id: "chat", type: "chat_postings" }, { id: "flow", type: "flow" }], bar: [{ id: "clock", type: "clock", grow: true }] }.freeze

  test "an arrangement keeps only blocks it knows, where they have a size, once each, and always the stage" do
    out = DeckArrangement.normalize(layout: "sideways", left: [{ type: "flow" }, { type: "flow" }, { type: "stage" }, { type: "nope" }],
                                    bar: [{ id: "x y", type: "clock", grow: "true" }, { type: "chat_postings" }])
    assert_equal "both", out["layout"]
    assert_equal [{ "id" => "flow", "type" => "flow" }], out["left"]
    assert_equal [{ "id" => "clock", "type" => "clock", "grow" => true }], out["bar"]
    assert_equal [{ "id" => "stage", "type" => "stage" }], out["main"]
    assert_nil DeckArrangement.normalize(nil)
  end

  test "host coordinators, record keepers and admins rearrange by default; hosts only when the group says so" do
    assert @group.decks_editable_by?(@admin)
    assert @group.decks_editable_by?(@coordinator)
    assert @group.decks_editable_by?(@keeper)
    assert_not @group.decks_editable_by?(@host)

    sign_in @host
    put path(@meeting.id, "arrangement"), params: { scope: "meeting", arrangement: RIGHT }, as: :json
    assert_response :forbidden
    get path(@meeting.id), as: :json
    assert_not response.parsed_body["can_arrange"]

    @group.update!(deck_editors: %w[hosts nonsense])
    assert_equal %w[hosts], @group.reload.deck_editors
    assert @group.decks_editable_by?(@host)

    @group.update!(deck_editors: [])
    assert_not @group.decks_editable_by?(@coordinator)
    assert_not @group.decks_editable_by?(@keeper)
    assert @group.decks_editable_by?(@admin)
  end

  test "a meeting's own layout covers its other days and leaves the others on the group's; saving for everyone replaces it" do
    sign_in @coordinator
    get path(@meeting.id), as: :json
    assert_nil response.parsed_body.dig("layout", "arrangement")
    built_in = response.parsed_body.dig("layout", "key")

    put path(@meeting.id, "arrangement"), params: { scope: "meeting", arrangement: RIGHT }, as: :json
    assert_response :success
    assert_equal "meeting", response.parsed_body.dig("layout", "scope")
    assert_equal "right", HostingLayout.for(@other_day).arrangement["layout"]
    assert_nil HostingLayout.for(@evening)
    assert_nil HostingKit.for(@meeting), "a layout doesn't make the meeting a kit of its own"

    post path(@meeting.id, "ping"), params: { activity: "Here" }, as: :json
    assert_not_equal built_in, response.parsed_body["layout_key"]

    put path(@evening.id, "arrangement"), params: { scope: "default", arrangement: { layout: "focus" } }, as: :json
    assert_response :success
    assert_equal "focus", HostingLayout.for(@evening).arrangement["layout"]
    assert_equal "right", HostingLayout.for(@meeting).arrangement["layout"]

    put path(@meeting.id, "arrangement"), params: { scope: "default", arrangement: { layout: "left" } }, as: :json
    assert_equal "default", response.parsed_body.dig("layout", "scope")
    assert_equal "left", HostingLayout.for(@meeting).arrangement["layout"]

    put path(@meeting.id, "arrangement"), params: { scope: "meeting", arrangement: RIGHT }, as: :json
    delete path(@meeting.id, "arrangement") + "?scope=meeting", as: :json
    assert_equal "default", response.parsed_body.dig("layout", "scope")
    delete path(@meeting.id, "arrangement") + "?scope=default", as: :json
    assert_nil response.parsed_body.dig("layout", "arrangement")
  end
end
