require "test_helper"

# Special Editions (ChipEdition): a group admin makes and publishes one; members claim a
# milestone they reached in its window (forever after), hosts give it during the run, Meeting
# Maker ones are given on their own, and each is numbered, up to how many there are
class Api::ChipEditionsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    travel_to Time.zone.local(2026, 10, 28, 12)
    @group = Group.create!(title: "The Acid Test")
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, name: "Ada")
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim", sobriety_date: Date.new(2026, 7, 30)) # 90 days on Oct 28
    @lee = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee", sobriety_date: Date.new(2025, 10, 1)) # 1 year on Oct 1
    @group.memberships.create!(user: @admin, role: "admin")
    [@kim, @lee].each { |u| @group.memberships.create!(user: u, role: "member") }
  end

  def make(**attrs)
    sign_in @admin
    post "/api/groups/#{@group.slug}/chip_editions", params: { edition: { name: "2026 Edition", kind: "milestone", starts_on: "2026-10-01", ends_on: "2026-12-31", window: "custom", **attrs } }, as: :json
    assert_response :created, response.body
    response.parsed_body["edition"]
  end

  def publish(edition)
    post "/api/groups/#{@group.slug}/chip_editions/#{edition['id']}/publish", as: :json
    assert_response :success
  end

  def recovery_for(user)
    sign_in user
    get "/api/recovery?today=#{Date.current.iso8601}", as: :json
    response.parsed_body
  end

  test "a milestone edition: members claim a milestone reached in its window, numbered, and its design is fixed after" do
    edition = make(how_many: "first_n", limit: 2, design: { round: { top_text: "Twenty twenty six" } })
    assert_empty recovery_for(@kim)["available"], "nothing until it's published"

    sign_in @admin
    publish(edition)
    assert Notification.exists?(user: @kim, kind: "chip.edition_new")

    available = recovery_for(@kim)["available"]
    assert_equal [["round:90d", edition["id"]]], available.map { |a| [a["slot"], a["edition_id"]] }, "only the 90 days fell in the window"
    post "/api/recovery/claim", params: { edition_id: edition["id"], slot: "round:90d" }, as: :json
    assert_response :created
    chip = response.parsed_body["chip"]
    assert_equal ["round:90d", 1, "2026 EDITION · NO. 001 OF 2"], [chip["slot"], chip.dig("edition", "serial"), chip.dig("edition", "mark")]
    assert_equal "Twenty twenty six", chip.dig("design", "round", "top_text")
    assert_includes recovery_for(@kim)["chips"].map { |c| c["id"] }, chip["id"]
    assert_empty recovery_for(@kim)["available"]

    post "/api/recovery/claim", params: { edition_id: edition["id"], slot: "round:60d" }, as: :json
    assert_response :unprocessable_entity, "60 days was before the window"

    sign_in @admin
    patch "/api/groups/#{@group.slug}/chip_editions/#{edition['id']}", params: { edition: { design: { round: { top_text: "Changed" } } } }, as: :json
    assert_response :unprocessable_entity, "minted chips never change"
    delete "/api/groups/#{@group.slug}/chip_editions/#{edition['id']}", as: :json
    assert_response :unprocessable_entity

    travel_to Time.zone.local(2028, 1, 5, 12)
    assert_equal ["round:year-1"], recovery_for(@lee)["available"].map { |a| a["slot"] }, "claimable forever after"
    post "/api/recovery/claim", params: { edition_id: edition["id"], slot: "round:year-1" }, as: :json
    assert_equal 2, response.parsed_body.dig("chip", "edition", "serial")
    assert_equal 0, ChipEdition.find(edition["id"]).limit - ChipEdition.find(edition["id"]).issued
  end

  test "hosts give an edition during its run, up to how many there are" do
    edition = make(how_many: "given_n", limit: 1)
    publish(edition)
    assert_empty recovery_for(@kim)["available"], "given ones aren't claimed"

    sign_in @admin
    get "/api/chip_awards", as: :json
    assert_equal [edition["id"]], response.parsed_body["groups"].first["editions"].map { |e| e["id"] }
    post "/api/chip_awards", params: { group_slug: @group.slug, user_id: @kim.id, milestone_key: "90d", chip_edition_id: edition["id"] }, as: :json
    assert_response :created
    award = ChipAward.last
    assert_equal [@kim, 1], [award.edition_chip.user, award.edition_chip.serial]
    assert_equal "2026 EDITION · NO. 001 OF 1", award.as_chip_json[:edition][:mark]

    post "/api/chip_awards", params: { group_slug: @group.slug, user_id: @lee.id, milestone_key: "year", years: 1, chip_edition_id: edition["id"] }, as: :json
    assert_response :unprocessable_entity
    assert_equal 1, ChipAward.count, "nothing given when they're all out"
  end

  test "Meeting Maker editions are given on their own to members who make enough meetings in the window" do
    meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: 3, start_minute: 420)
    edition = make(kind: "meeting_maker", name: "Thanksgiving", starts_on: "2026-10-01", ends_on: "2026-10-31", target_count: 2, design: { meeting: { shape: "round", color: "#884400" } })
    publish(edition)
    MeetingJoin.create!(user: @kim, meeting: meeting, starts_at: Time.zone.local(2026, 9, 30, 7))
    MeetingJoin.create!(user: @kim, meeting: meeting, starts_at: Time.zone.local(2026, 10, 7, 7))
    assert_not recovery_for(@kim)["chips"].any? { |c| c["source"] == "edition" }, "the September one was before the window"

    MeetingJoin.create!(user: @kim, meeting: meeting, starts_at: Time.zone.local(2026, 10, 14, 7))
    chip = recovery_for(@kim)["chips"].find { |c| c["source"] == "edition" }
    assert_equal ["meeting", "round", 2, "2026-10-14", "THANKSGIVING · NO. 001"], [chip["kind"], chip["shape"], chip["count"], chip["on"], chip.dig("edition", "mark")]
    assert_equal "Thanksgiving", chip.dig("design", "meeting", "sides", 2), "its name along the bottom"
    assert Notification.exists?(user: @kim, kind: "chip.edition")
    assert_equal 1, recovery_for(@kim)["chips"].count { |c| c["source"] == "edition" }, "only once"
  end

  test "only the group's admins make editions" do
    sign_in @kim
    post "/api/groups/#{@group.slug}/chip_editions", params: { edition: { name: "Mine", starts_on: "2026-10-01", ends_on: "2026-10-02" } }, as: :json
    assert_response :forbidden
  end
end
