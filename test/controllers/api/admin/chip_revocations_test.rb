require "test_helper"

# Site Admin > Members > Chips: a site admin takes back a chip someone got by mistake, puts
# another chip from that milestone's stack on top, without notifying the member (ChipRevocation)
class Api::Admin::ChipRevocationsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    travel_to Time.zone.local(2026, 11, 15, 12)
    @old_admins = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "admin@example.com"
    @admin = User.create!(email: "admin@example.com", password: "password123", confirmed: true, name: "Ada Admin", admin: true)
    @group = Group.create!(title: "The Acid Test")
    @host = User.create!(email: "host@example.com", password: "password123", confirmed: true, name: "Hal")
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim", sobriety_date: Date.new(2025, 11, 1)) # 1 year on Nov 1
    @group.memberships.create!(user: @host, role: "admin")
    @group.memberships.create!(user: @kim, role: "member")
  end

  teardown { ENV["ADMIN_EMAILS"] = @old_admins }

  def give(user, key, years: nil, group: @group, on: Date.new(2026, 11, 1))
    award = ChipAward.create!(group: group, given_by: @host, email: user.email, milestone_key: key, years: years, on: on)
    award.claim!(user)
    award
  end

  def share!(user, chip_id)
    note = user.timeline_notes.new(body: "Look what I got!", visibility: "public", chip_id: chip_id, chip: TimelineNote.chip_for(user, chip_id))
    note.save!
    note
  end

  test "takes back a given chip, puts the earned one on top, swaps it in their post, without notifying them" do
    award = give(@kim, "year", years: 1)
    @kim.update!(chip_tops: { "round:year-1" => "award:#{award.id}" }, chip_favorites: ["award:#{award.id}", "round:24h"])
    note = share!(@kim, "award:#{award.id}")

    sign_in @admin
    get "/api/admin/users/#{@kim.id}/chips", as: :json
    assert_response :success
    stack = response.parsed_body["stacks"].find { |s| s["slot"] == "round:year-1" }
    assert_equal ["award:#{award.id}", "round:year-1"], stack["chips"].map { |c| c["id"] }, "the given one is on top"
    assert_equal [true, false], stack["chips"].map { |c| c["revocable"] }
    assert_nil response.parsed_body["stacks"].find { |s| s["slot"] == "round:24h" }, "stacks of only earned chips aren't listed"

    post "/api/admin/users/#{@kim.id}/revoke_chip", params: { chip_id: "award:#{award.id}", replacement_id: "round:year-1", note: "That one was meant for someone else." }, as: :json
    assert_response :success, response.body

    assert award.reload.revoked_at
    @kim.reload
    assert_equal "round:year-1", @kim.chip_tops["round:year-1"]
    assert_equal ["round:year-1", "round:24h"], @kim.chip_favorites
    assert_not_includes Chips.catalog(@kim)[:chips].map { |c| c[:id] }, "award:#{award.id}"

    note.reload
    assert_equal "Look what I got!", note.body, "their words aren't touched"
    assert_equal "round:year-1", note.chip_id
    assert_equal "earned", note.chip["source"]
    assert_not note.chip_hidden

    revocation = ChipRevocation.last
    assert_equal [@admin, "award:#{award.id}", "round:year-1", 1, 0], [revocation.revoked_by, revocation.chip_id, revocation.replacement_id, revocation.posts_swapped, revocation.posts_hidden]
    assert_equal "The Acid Test", revocation.chip.dig("group", "title")
    assert_equal "award:#{award.id}", response.parsed_body["history"].first["chip_id"]

    assert_equal "That one was meant for someone else.", revocation.note, "kept for admins"
    assert_equal 1, @kim.notifications.count, "only the original gift's; nothing about taking it back"
  end

  test "with nothing else in the stack, gives RecoveryBot's own chip instead, without a second popup" do
    award = give(@kim, "18m", on: Date.new(2026, 11, 10)) # not earned yet: alone in its stack
    sign_in @admin
    get "/api/admin/users/#{@kim.id}/chips", as: :json
    stack = response.parsed_body["stacks"].find { |s| s["slot"] == "round:18m" }
    assert stack["site_ok"]

    post "/api/admin/users/#{@kim.id}/revoke_chip", params: { chip_id: "award:#{award.id}", replacement_id: "site" }, as: :json
    assert_response :success, response.body

    site = @kim.chip_awards.claimed.sole
    assert site.site?
    assert_equal ["18m", Date.new(2026, 11, 10), @admin], [site.milestone_key, site.on, site.given_by]
    assert site.celebrated_at, "the swap's notification says it; no confetti popup"
    assert_equal "award:#{site.id}", @kim.reload.chip_tops["round:18m"]
    assert_equal 1, @kim.notifications.where(kind: "chip.given").count, "only the original gift's"
  end

  test "taking back a claimed Special Edition keeps its number used and it can't be claimed again" do
    edition = ChipEdition.create!(group: @group, name: "2026 Edition", kind: "milestone", starts_on: Date.new(2026, 10, 1), ends_on: Date.new(2026, 12, 31), published_at: Time.current)
    chip = edition.claim!(@kim, "round:year-1")
    note = share!(@kim, "edition:#{chip.id}")

    sign_in @admin
    post "/api/admin/users/#{@kim.id}/revoke_chip", params: { chip_id: "edition:#{chip.id}" }, as: :json
    assert_response :success, response.body

    assert chip.reload.revoked_at
    assert_equal 1, edition.reload.issued
    assert_empty ChipEdition.available_for(@kim), "they can't claim it again"
    assert note.reload.chip_hidden, "with no replacement, the chip post is hidden from others"
    assert_equal 1, ChipRevocation.last.posts_hidden
    assert_equal 0, @kim.notifications.count, "they aren't told"
  end

  test "a replacement has to be in the same milestone's stack" do
    award = give(@kim, "year", years: 1)
    sign_in @admin
    post "/api/admin/users/#{@kim.id}/revoke_chip", params: { chip_id: "award:#{award.id}", replacement_id: "round:24h" }, as: :json
    assert_response :unprocessable_entity
    assert_match "same milestone", response.parsed_body["error"]
    assert_nil award.reload.revoked_at, "nothing changed"
    assert_equal 0, ChipRevocation.count
  end

  test "earned chips can't be taken back" do
    sign_in @admin
    post "/api/admin/users/#{@kim.id}/revoke_chip", params: { chip_id: "round:year-1" }, as: :json
    assert_response :unprocessable_entity
    assert_match "can't be taken back", response.parsed_body["error"]
  end

  test "only site admins can see or take back someone's chips" do
    award = give(@kim, "year", years: 1)
    [@host, @kim].each do |who|
      sign_in who
      get "/api/admin/users/#{@kim.id}/chips", as: :json
      assert_response :forbidden
      post "/api/admin/users/#{@kim.id}/revoke_chip", params: { chip_id: "award:#{award.id}" }, as: :json
      assert_response :forbidden
    end
    # An admin flag without being on ADMIN_EMAILS isn't enough either
    @host.update!(admin: true)
    sign_in @host
    post "/api/admin/users/#{@kim.id}/revoke_chip", params: { chip_id: "award:#{award.id}" }, as: :json
    assert_response :forbidden
    assert_nil award.reload.revoked_at
  end

  test "the giver's list says it was taken back" do
    award = give(@kim, "year", years: 1)
    ChipRevocation.revoke!(user: @kim, chip_id: "award:#{award.id}", by: @admin)
    sign_in @host
    get "/api/chip_awards", as: :json
    assert_response :success
    assert response.parsed_body["given"].find { |a| a["id"] == award.id }["revoked"]
  end

  test "site admins see Change this chip on a post of a given chip, and nobody else does" do
    award = give(@kim, "year", years: 1)
    note = share!(@kim, "award:#{award.id}")
    assert note.as_api_json(viewer: @admin)[:chip_admin]
    assert_nil note.as_api_json(viewer: @kim)[:chip_admin]
    assert_nil note.as_api_json(viewer: @host)[:chip_admin]
    earned = share!(@kim, "round:year-1")
    assert earned.as_api_json(viewer: @admin)[:chip_admin], "any chip post: the dialog shows another of theirs when it can't go back"

    sign_in @admin
    post "/api/admin/users/#{@kim.id}/revoke_chip", params: { chip_id: "award:#{award.id}", replacement_id: "round:year-1" }, as: :json
    assert_response :success
    assert_equal "round:year-1", response.parsed_body.dig("revocation", "replacement", "id")
    assert response.parsed_body.dig("revocation", "replacement", "design"), "the post can draw it straight away"
    assert_equal "round:year-1", note.reload.chip_id
  end

  test "a post whose chip they no longer have can show another chip they do have" do
    edition = ChipEdition.create!(group: @group, name: "2026 Edition", kind: "milestone", starts_on: Date.new(2026, 10, 1), ends_on: Date.new(2026, 12, 31), published_at: Time.current)
    chip = edition.claim!(@kim, "round:year-1")
    note = share!(@kim, "edition:#{chip.id}")
    edition.destroy! # its chips go with it, the post stays
    assert note.reload.as_api_json(viewer: @admin)[:chip_admin]

    sign_in @admin
    get "/api/admin/users/#{@kim.id}/chips", as: :json
    assert_includes response.parsed_body["all"].map { |c| c["id"] }, "round:year-1"

    post "/api/admin/users/#{@kim.id}/post_chip", params: { note_id: note.id, chip_id: "round:9m" }, as: :json
    assert_response :success, response.body
    note.reload
    assert_equal ["round:9m", "earned", "Look what I got!"], [note.chip_id, note.chip["source"], note.body]
    assert note.chip["design"]
    assert_not note.chip_hidden
    assert_equal 0, @kim.notifications.count, "they aren't told"

    post "/api/admin/users/#{@kim.id}/post_chip", params: { note_id: note.id, chip_id: "round:5-years" }, as: :json
    assert_response :unprocessable_entity, "only chips they have"
    assert_equal "round:9m", note.reload.chip_id

    sign_in @host
    post "/api/admin/users/#{@kim.id}/post_chip", params: { note_id: note.id, chip_id: "round:year-1" }, as: :json
    assert_response :forbidden
    assert_equal "round:9m", note.reload.chip_id
  end
end
