require "test_helper"

# A member's 10th step inventories, gratitude lists and chips (Api::RecoveryController,
# Api::StepInventoriesController, Api::GratitudeListsController) and a group's chip design
# (Api::GroupChipsController)
class Api::RecoveryToolsTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim", sobriety_date: Date.current - 100)
    @lee = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee")
    @group = Group.create!(title: "The Acid Test")
    @other = Group.create!(title: "Sunrise Group")
  end

  def day(n = 0) = (Date.current - n).iso8601

  test "a 10th step saves for the day, keeps only the questions, and earns the first triangle chip" do
    sign_in @kim
    put "/api/step_inventories/#{day}", params: { answers: { resentful: { answer: "yes", note: "At work" }, kind: { answer: "maybe" }, bogus: { answer: "yes" } }, notes: "Call Sam" }, as: :json
    assert_response :success
    body = response.parsed_body
    assert_equal({ "kind" => "inventory", "count" => 1 }, body["new_chip"])
    assert_equal({ "resentful" => { "answer" => "yes", "note" => "At work" } }, body.dig("entry", "answers"))
    assert_equal "Call Sam", body.dig("entry", "notes")

    # Saving the same day again changes it, and earns nothing new
    put "/api/step_inventories/#{day}", params: { answers: { afraid: { answer: "no" } }, notes: "" }, as: :json
    assert_nil response.parsed_body["new_chip"]
    assert_equal 1, @kim.step_inventories.count
    assert_equal({ "afraid" => { "answer" => "no", "note" => "" } }, @kim.step_inventories.first.answers)

    # Emptied, it goes
    put "/api/step_inventories/#{day}", params: { answers: {}, notes: "" }, as: :json
    assert_nil response.parsed_body["entry"]
    assert_equal 0, @kim.step_inventories.count
  end

  test "nobody else can read a member's inventories or gratitude lists" do
    @kim.step_inventories.create!(on: Date.current, notes: "private")
    @kim.gratitude_lists.create!(on: Date.current, items: ["my sponsor"])
    sign_in @lee
    get "/api/step_inventories/#{day}"
    assert_nil response.parsed_body["entry"]
    get "/api/gratitude_lists"
    assert_equal [], response.parsed_body["entries"]

    sign_out @lee
    get "/api/gratitude_lists", as: :json
    assert_response :unauthorized
  end

  test "gratitude lists drop blank lines, list newest first, and count toward triangle chips" do
    sign_in @kim
    7.times do |i|
      put "/api/gratitude_lists/#{day(6 - i)}", params: { items: ["Coffee", "  ", "My group"] }, as: :json
    end
    assert_equal({ "kind" => "gratitude", "count" => 7 }, response.parsed_body["new_chip"])
    assert_equal ["Coffee", "My group"], @kim.gratitude_lists.find_by(on: Date.current).items

    get "/api/gratitude_lists"
    body = response.parsed_body
    assert_equal day, body["entries"].first["on"]
    assert_equal 7, body["total"]

    get "/api/recovery?today=#{day}"
    triangles = response.parsed_body["triangles"]["gratitude"]
    assert_equal [1, 7], triangles["earned"].map { |c| c["count"] }
    assert_equal day(6), triangles["earned"].first["on"]
    assert_equal 30, triangles["next"]
    assert response.parsed_body["today"]["gratitude"]
  end

  test "a day in the future isn't taken" do
    sign_in @kim
    put "/api/gratitude_lists/#{(Date.current + 5).iso8601}", params: { items: ["Tomorrow"] }, as: :json
    assert_response :unprocessable_entity
  end

  test "chips come in the home group's design, and the member picks which group" do
    @group.memberships.create!(user: @kim, role: "member")
    @other.memberships.create!(user: @kim, role: "member")
    @other.update!(chip_design: { "round" => { "top_text" => "Sunrise" } })
    sign_in @kim

    get "/api/recovery"
    body = response.parsed_body
    assert_equal "the-acid-test", body.dig("home_group", "slug")
    assert_equal ChipDesign::DEFAULT["round"]["top_text"], body.dig("design", "round", "top_text")
    assert_equal (Date.current - 100).iso8601, body["sobriety_date"]

    patch "/api/recovery", params: { home_group: @other.slug }, as: :json
    assert_equal "Sunrise", response.parsed_body.dig("design", "round", "top_text")
    assert_equal @other, @kim.reload.chip_group

    # Not one of theirs
    patch "/api/recovery", params: { home_group: Group.create!(title: "Elsewhere").slug }, as: :json
    assert_response :unprocessable_entity
  end

  test "group admins design the chips; only changes from the default are kept" do
    @group.memberships.create!(user: @kim, role: "admin")
    @group.memberships.create!(user: @lee, role: "member")
    sign_in @lee
    put "/api/groups/#{@group.slug}/chips", params: { design: { round: { top_text: "Nope" } } }, as: :json
    assert_response :forbidden

    sign_in @kim
    design = ChipDesign::DEFAULT.deep_dup
    design["round"]["colors"]["30d"] = "#00FF00"
    design["round"]["emblem"] = "logo"
    design["round"]["finish"] = "shiny" # not a finish
    design["triangle"]["sides"] = ["One", "Two", "Three"]
    put "/api/groups/#{@group.slug}/chips", params: { design: design }, as: :json
    assert_response :success
    assert_equal({ "round" => { "emblem" => "logo", "colors" => { "30d" => "#00ff00" } }, "triangle" => { "sides" => %w[One Two Three] } }, @group.reload.chip_design)
    assert_equal "classic", response.parsed_body.dig("design", "round", "finish")
    assert_equal "#c62839", response.parsed_body.dig("default", "round", "colors", "30d")

    put "/api/groups/#{@group.slug}/chips", params: { reset: true }, as: :json
    assert_nil @group.reload.chip_design
  end

  test "deleting the account takes the inventories and lists with it" do
    @kim.step_inventories.create!(on: Date.current, notes: "x")
    @kim.gratitude_lists.create!(on: Date.current, items: ["y"])
    @kim.destroy!
    assert_equal 0, StepInventory.count
    assert_equal 0, GratitudeList.count
  end

  test "the recovery pages are for signed-in members and never indexed" do
    get "/recovery/inventory"
    assert_redirected_to "/users/sign_in"
    sign_in @lee
    get "/recovery/gratitude"
    assert_response :success
    assert_select "#recovery-root"
    assert_equal "noindex, nofollow", response.headers["X-Robots-Tag"]
  end
end

class ChipsTest < ActiveSupport::TestCase
  test "triangle chips at 1, 7, 30, 90, 180, 365, then every 365" do
    assert_equal [1, 7, 30, 90, 180, 365, 730], Chips.triangle_counts(400)
    assert_equal 7, Chips.just_earned(6, 7)
    assert_nil Chips.just_earned(7, 8)
    assert_nil Chips.just_earned(8, 7)
    assert_equal 1095, Chips.next_count(730)
  end
end
