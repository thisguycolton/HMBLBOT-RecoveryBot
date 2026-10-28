require "test_helper"

# Sharing a chip to your timeline: a note with the chip on it (Api::TimelineNotesController,
# chip_id), kept as it looked, and off others' feeds while you don't have a sobriety chip you
# shared (TimelineNote.sync_chips)
class Api::ChipSharesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @group = Group.create!(title: "The Acid Test")
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim", sobriety_date: Date.current - 100)
    @lee = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee")
    [@kim, @lee].each { |u| @group.memberships.create!(user: u, role: "member") }
    @lee.follows_given.create!(followed: @kim)
  end

  def share(chip_id, **note)
    post "/api/timeline_notes", params: { note: { chip_id: chip_id, today: Date.current.iso8601, visibility: "followers", **note } }, as: :json
  end

  test "a member shares a chip they have, with or without words, and followers see it" do
    sign_in @kim
    share("round:90d")
    assert_response :created
    chip = response.parsed_body["chip"]
    assert_equal ["round:90d", "90 days", "round"], chip.values_at("id", "label", "shape")
    assert_equal ChipDesign::DEFAULT["round"]["top_text"], chip.dig("design", "round", "top_text"), "the design it was minted in comes along"

    share("round:year-1")
    assert_response :unprocessable_entity, "not one of theirs yet"

    get "/api/recovery?today=#{Date.current.iso8601}", as: :json
    assert_equal ["round:90d"], response.parsed_body["shared"]

    sign_in @lee
    get "/api/people/kim", as: :json
    feed = response.parsed_body.dig("context", "feed")
    assert_equal ["90 days"], feed.filter_map { |i| i.dig("chip", "label") }
  end

  test "a given chip's private note stays out, and the chip keeps its look when the group redesigns" do
    award = @group.chip_awards.create!(email: @kim.email, user: @kim, milestone_key: "30d", on: Date.current, note: "Just for you", claimed_at: Time.current)
    @group.update!(chip_design: { "round" => { "top_text" => "Acid Test" } })
    sign_in @kim
    share("award:#{award.id}")
    assert_response :created
    note = TimelineNote.last
    assert_nil note.chip["note"]
    assert_equal "Acid Test", note.chip.dig("design", "round", "top_text")

    @group.update!(chip_design: { "round" => { "top_text" => "Something else" } })
    get "/api/people/kim", as: :json
    assert_equal "Acid Test", response.parsed_body.dig("context", "feed", 0, "chip", "design", "round", "top_text")
  end

  test "a sobriety chip they no longer have leaves others' feeds, and comes back" do
    sign_in @kim
    share("round:90d", group_slugs: [@group.slug])
    note = TimelineNote.last
    @kim.update!(sobriety_date: Date.current - 10)
    assert note.reload.chip_hidden

    sign_in @lee
    get "/api/people/kim", as: :json
    assert_empty response.parsed_body.dig("context", "feed")
    assert_empty @group.shared_notes.to_a
    assert_not note.visible_to?(@lee)

    sign_in @kim
    get "/api/people/kim", as: :json
    assert response.parsed_body.dig("context", "feed", 0, "chip_hidden"), "they still see it, marked"

    @kim.update!(sobriety_date: Date.current - 120)
    assert_not note.reload.chip_hidden
    assert note.visible_to?(@lee)
  end
end
