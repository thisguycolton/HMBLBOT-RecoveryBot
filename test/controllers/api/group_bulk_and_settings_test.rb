require "test_helper"

class Api::GroupBulkAndSettingsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @admin = User.create!(email: "admin@example.com", name: "Ada", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @admin, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @a = @group.motions.create!(title: "Move the workshop", status: "passed", decided_on: Date.current, needs_review: true)
    @b = @group.motions.create!(title: "Buy a Zoom plan", status: "passed", decided_on: Date.current)
  end

  def motions_bulk(**body) = post("/api/groups/#{@group.slug}/motions/bulk", params: body, as: :json)
  def docs_bulk(**body) = post("/api/groups/#{@group.slug}/documents/bulk", params: body, as: :json)

  test "record keepers act on many decisions at once; only admins delete them" do
    sign_in @member
    motions_bulk(ids: [@a.id], do: "ignore_rules")
    assert_response :forbidden

    sign_in @keeper
    assert_includes @a.warnings, "No second is recorded."
    motions_bulk(ids: [@a.id, @b.id], do: "ignore_rules")
    assert_equal 2, response.parsed_body["updated"]
    assert_not_includes @a.reload.warnings, "No second is recorded."
    motions_bulk(ids: [@a.id], do: "mark_checked")
    assert_not @a.reload.needs_review
    motions_bulk(ids: [@a.id], do: "category", value: "format")
    assert_equal "format", @a.reload.category
    motions_bulk(ids: [@a.id], do: "category", value: "nonsense")
    assert_response :unprocessable_entity
    motions_bulk(ids: [@a.id], do: "delete")
    assert_response :forbidden

    sign_in @admin
    motions_bulk(ids: [@a.id, @b.id], do: "delete")
    assert_equal 0, @group.motions.count
  end

  test "record keepers move documents between folders; only admins delete them" do
    docs = 2.times.map { |i| @group.documents.create!(title: "Doc #{i}", kind: "other", body: "<p>Hi</p>", created_by: @keeper) }
    sign_in @keeper
    docs_bulk(ids: docs.map(&:id), do: "move", value: "format")
    assert_equal %w[format format], docs.map { |d| d.reload.kind }
    docs_bulk(ids: docs.map(&:id), do: "pin")
    assert docs.all? { |d| d.reload.pinned }
    docs_bulk(ids: docs.map(&:id), do: "delete")
    assert_response :forbidden

    sign_in @admin
    docs_bulk(ids: docs.map(&:id), do: "delete")
    assert_equal 0, @group.documents.count
  end

  test "a group that turns Robert's Rules off gets no rules warnings" do
    assert_includes @b.warnings, "No second is recorded."
    sign_in @admin
    patch "/api/groups/#{@group.slug}", params: { group: { follows_roberts_rules: false } }, as: :json
    assert_response :success
    assert_equal false, response.parsed_body["follows_roberts_rules"]
    assert_empty @b.reload.warnings
    assert_equal ["Brought in from old minutes: check it against them, then save it so members can see it."], @a.reload.warnings
  end

  test "group admins set a logo and take it off" do
    sign_in @admin
    patch "/api/groups/#{@group.slug}", params: { group: { logo: fixture_file_upload(Rails.root.join("test/fixtures/files/avatar.png"), "image/png") } }
    assert_response :success
    assert_match %r{/rails/active_storage/}, response.parsed_body["logo_url"]

    patch "/api/groups/#{@group.slug}", params: { group: { remove_logo: "1" } }
    assert_response :success
    assert_not @group.reload.logo.attached?
  end
end
