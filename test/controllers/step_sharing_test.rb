require "test_helper"

# Sharing worksheets, never answers: a sponsor suggesting one to a sponsee (StepSuggestion), a
# group sharing one for a step study (GroupStepTool), and the step a sponsee is on
class StepSharingTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @pat = person("Pat") # sponsor
    @sam = person("Sam") # sponsee
    @lee = person("Lee")
    @link = Sponsorship.create!(sponsor: @pat, sponsee: @sam, status: "active", started_on: Date.current)
  end

  def person(name)
    User.create!(name: name, email: "#{name.downcase}@example.com", password: "password123", password_confirmation: "password123",
                 confirmed_at: Time.current, confirmed: true)
  end

  def as(user)
    sign_out :user
    sign_in user
  end

  test "a sponsor suggests their customized copy without answers, and the sponsee starts it" do
    as @pat
    post "/api/step_works", params: { tool_key: "step4-big-book" }, as: :json
    work = StepWork.find(response.parsed_body.dig("work", "id"))
    work.update!(name: "Pat's four columns", answers: { "resentments" => [{ "who" => "Secret" }] })

    post "/api/step_suggestions", params: { sponsorship_ids: [@link.id], work_id: work.id, note: "Start here" }, as: :json
    assert_response :created
    assert_equal "sponsorship.suggestion", @sam.notifications.last.kind

    as @sam
    get "/api/step_works"
    sg = response.parsed_body["suggestions"].sole
    assert_equal ["Pat's four columns", "Start here", "Pat"], [sg["name"], sg["note"], sg["sponsor"]["name"]]
    assert_includes response.parsed_body["attention"].map { |i| i["title"] }, "Pat suggested Pat's four columns"

    post "/api/step_suggestions/#{sg['id']}/start"
    assert_response :created
    mine = StepWork.find(response.parsed_body.dig("work", "id"))
    assert_equal [@sam, "Pat's four columns", {}], [mine.user, mine.name, mine.answers]
    get "/api/step_works"
    assert_empty response.parsed_body["suggestions"]
  end

  test "only a sponsor's own sponsees can be suggested to, and ending it takes suggestions with it" do
    as @lee
    post "/api/step_suggestions", params: { sponsorship_ids: [@link.id], tool_key: "step8-amends-list" }, as: :json
    assert_response :unprocessable_entity

    as @pat
    post "/api/step_suggestions", params: { sponsorship_ids: [@link.id], tool_key: "step8-amends-list" }, as: :json
    assert_response :created
    as @sam
    delete "/api/sponsorships/#{@link.id}"
    assert_equal 0, StepSuggestion.count
  end

  test "either of them sets the step the sponsee is on" do
    as @pat
    patch "/api/sponsorships/#{@link.id}", params: { current_step: 4 }, as: :json
    assert_response :success
    assert_equal 4, @link.reload.current_step
    assert_equal "sponsorship.step", @sam.notifications.last.kind
    as @sam
    patch "/api/sponsorships/#{@link.id}", params: { current_step: 13 }, as: :json
    assert_response :unprocessable_entity
    as @lee
    patch "/api/sponsorships/#{@link.id}", params: { current_step: 5 }, as: :json
    assert_response :not_found
  end

  test "a group's hosts share a worksheet; members start it; only hosts and admins can share" do
    group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    group.memberships.create!(user: @pat, role: "member", can_host: true)
    group.memberships.create!(user: @sam, role: "member")

    as @sam
    post "/api/group_step_tools", params: { group_slug: group.slug, tool_key: "step1-powerlessness" }, as: :json
    assert_response :forbidden

    as @pat
    post "/api/group_step_tools", params: { group_slug: group.slug, tool_key: "step4-big-book", summary: "Weeks 3 to 6" }, as: :json
    assert_response :created
    tool = GroupStepTool.last

    as @sam
    get "/api/step_works"
    shared = response.parsed_body["group_tools"].sole
    assert_equal ["Weeks 3 to 6", "Acid Test", false], [shared["summary"], shared["group"]["title"], shared["can_remove"]]
    post "/api/step_works", params: { group_tool_id: tool.id }, as: :json
    assert_response :created
    delete "/api/group_step_tools/#{tool.id}"
    assert_response :forbidden

    as @lee
    get "/api/step_works"
    assert_empty response.parsed_body["group_tools"]
    post "/api/step_works", params: { group_tool_id: tool.id }, as: :json
    assert_response :not_found
  end

  test "Sponsors in this group lists only that group's offers" do
    a = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    b = Group.create!(title: "Sunrise", time_zone: "America/Chicago")
    jo = person("Jo")
    jo.update_columns(created_at: 1.month.ago)
    [a, b].each { |g| g.memberships.create!(user: @sam, role: "member") }
    b.memberships.create!(user: jo, role: "member")
    SponsorProfile.create!(user: jo, available: true)

    as @sam
    get "/api/sponsor_profile/find", params: { group: a.slug }
    assert_empty response.parsed_body["sponsors"]
    get "/api/sponsor_profile/find", params: { group: b.slug }
    assert_equal ["Jo"], response.parsed_body["sponsors"].map { |s| s["person"]["name"] }
  end
end
