require "test_helper"

# HostDeck's templates (DeckTemplate): a group saves its own, shares one to the gallery, a site
# admin publishes it, and other groups see it. Plus the share queue, document and links blocks.
class Api::DeckTemplatesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @keeper = User.create!(email: "keeper@example.com", name: "Kit", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @other = User.create!(email: "other@example.com", name: "Oz", password: "password123", confirmed: true)
    @site = User.create!(email: "site@example.com", name: "Sid", password: "password123", confirmed: true, admin: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @elsewhere = Group.create!(title: "Night Owls", time_zone: "America/Phoenix")
    @elsewhere.memberships.create!(user: @other, role: "member")
  end

  def path(group = @group, *rest) = ["/api/groups/#{group.slug}/deck_templates", *rest].join("/")

  LAYOUT = { layout: "left", left: [{ id: "speakers", type: "share_queue", settings: { title: "Speakers" } },
                                    { id: "links-1", type: "links", settings: { links: [{ title: "Program", url: "https://example.org/program" }, { url: "ftp://nope" }] } }],
             main: [{ id: "doc-1", type: "document", settings: { document_id: "12" } }] }.freeze

  test "a group saves a template, shares it, and other groups see it once a site admin publishes it" do
    sign_in @member
    post path, params: { deck_template: { name: "Speaker night", arrangement: LAYOUT } }, as: :json
    assert_response :forbidden

    sign_in @keeper
    post path, params: { deck_template: { name: "Speaker night", purpose: "event", description: "For our anniversary", arrangement: LAYOUT, share: true } }, as: :json
    assert_response :created
    template = DeckTemplate.find(response.parsed_body["id"])
    assert_equal "pending", template.gallery
    assert_equal [{ "title" => "Program", "url" => "https://example.org/program" }], template.arrangement["left"][1]["settings"]["links"]
    assert_equal({ "document_id" => 12 }, template.arrangement["main"][1]["settings"])
    assert_equal "stage", template.arrangement["main"][0]["type"]

    sign_in @other
    get path(@elsewhere), as: :json
    assert_empty response.parsed_body["gallery"]
    assert_nil response.parsed_body["pending"]
    patch path(@elsewhere, template.id), params: { review: "publish" }, as: :json
    assert_includes [403, 404], response.status

    with_env("ADMIN_EMAILS" => "site@example.com") do
      sign_in @site
      get path(@elsewhere), as: :json
      assert_equal [template.id], response.parsed_body["pending"].map { _1["id"] }
      patch path(@elsewhere, template.id), params: { review: "publish" }, as: :json
      assert_response :success
      assert_equal "published", template.reload.gallery
    end

    sign_in @other
    get path(@elsewhere), as: :json
    assert_equal ["Speaker night"], response.parsed_body["gallery"].map { _1["name"] }
    assert_equal "Sunrise Crew", response.parsed_body["gallery"].first.dig("group", "title")

    sign_in @keeper
    patch path(@group, template.id), params: { deck_template: { share: false } }, as: :json
    assert_equal "none", template.reload.gallery
    delete path(@group, template.id), as: :json
    assert_response :no_content
  end

  test "a share queue calls on whoever's next, for everyone with the deck open" do
    deck = @group.decks.create!(name: "Anniversary", purpose: "event", created_by: @keeper, arrangement: LAYOUT)
    sign_in @member
    act = ->(op, item = nil) { post "/api/groups/#{@group.slug}/decks/#{deck.id}/act", params: { act: "block", label: "Speakers", data: { block_id: "speakers", op: op, item: item }.compact }, as: :json }
    act.call("queue_add", "Kim")
    act.call("queue_add", "Sam")
    queue = response.parsed_body.dig("block_state", "speakers", "queue")
    assert_equal %w[Kim Sam], queue.map { _1["name"] }
    act.call("queue_next")
    state = response.parsed_body.dig("block_state", "speakers")
    assert_equal "Kim", state.dig("now", "name")
    assert_equal %w[Sam], state["queue"].map { _1["name"] }
    act.call("queue_remove", state["queue"].first["id"])
    act.call("queue_done")
    assert_equal({ "queue" => [] }, response.parsed_body.dig("block_state", "speakers"))
    assert_includes deck.sessions.sole.log.map { _1["text"] }, "Called on Kim"
  end

  private

  def with_env(vars)
    old = vars.keys.index_with { ENV[_1] }
    vars.each { |k, v| ENV[k] = v }
    yield
  ensure
    old.each { |k, v| ENV[k] = v }
  end
end
