require "test_helper"

# Working the steps: the built-in worksheets (StepTool) and a member's work on them (StepWork,
# Api::StepWorksController)
class StepWorksTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @sam = User.create!(name: "Sam", email: "sam@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current)
    @lee = User.create!(name: "Lee", email: "lee@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current)
    sign_in @sam
  end

  test "every built-in worksheet loads and keeps its sections" do
    assert StepTool.all.size >= 8
    StepTool.all.each do |t|
      assert t.definition["sections"].any?, t.key
      assert_includes StepTool::STEPS, t.step
      # each, scale and options_from point at sections that exist
      ids = t.definition["sections"].map { |s| s["id"] }
      t.definition["sections"].each do |s|
        %w[from options_from].each { |k| assert_includes ids, s[k], "#{t.key} #{s['id']} #{k}" if s[k] }
        assert_includes ids, s.dig("rows_from_section", "section") if s["rows_from_section"]
      end
    end
    assert_equal 1, StepTool.all.count { |t| t.step == 4 && t.default? }
  end

  test "start a worksheet, write in it, and it's encrypted and only yours" do
    get "/api/step_works"
    assert_includes response.parsed_body["tools"].map { |t| t["key"] }, "drop-the-rock"
    post "/api/step_works", params: { tool_key: "step4-big-book" }, as: :json
    assert_response :created
    id = response.parsed_body.dig("work", "id")

    patch "/api/step_works/#{id}", params: { answers: { resentments: [{ who: "My boss", cause: "Passed me over", part: %w[Selfish Frightened] }] } }, as: :json
    assert_response :success
    work = StepWork.find(id)
    assert_equal "My boss", work.answers["resentments"].first["who"]
    raw = StepWork.connection.select_value("SELECT answers FROM step_works WHERE id = #{id}")
    assert_not_includes raw, "My boss"

    sign_out :user
    sign_in @lee
    get "/api/step_works/#{id}"
    assert_response :not_found
    patch "/api/step_works/#{id}", params: { answers: {} }, as: :json
    assert_response :not_found
  end

  test "later steps pull names and my part from earlier work" do
    four = StepWork.start!(@sam, StepTool.find("step4-big-book"))
    four.update!(answers: { "resentments" => [{ "who" => "Dad", "part" => ["Selfish"] }], "sex-conduct" => [{ "who" => "Jo", "part" => ["Inconsiderate"] }] })
    defects = StepWork.start!(@sam, StepTool.find("step4-12-and-12"))
    defects.update!(answers: { "defects" => { "Pride" => { "part" => "Yes" }, "Sloth" => { "part" => "Not really" } } })

    get "/api/step_works/pull", params: { step: 4, role: "who" }
    assert_equal %w[Dad Jo], response.parsed_body["values"].sort
    get "/api/step_works/pull", params: { step: 4, role: "my_part" }
    assert_equal %w[Inconsiderate Pride Selfish], response.parsed_body["values"].sort
  end

  test "customizing keeps only what a worksheet can hold" do
    work = StepWork.start!(@sam, StepTool.find("step4-questions"))
    definition = work.definition.deep_dup
    definition["sections"].first["items"] << { "id" => "mine", "label" => "What am I proud of?" }
    definition["sections"] << { "id" => "bad", "kind" => "script", "title" => "Nope" }
    patch "/api/step_works/#{work.id}", params: { definition: definition }, as: :json
    assert_response :success
    sections = work.reload.definition["sections"]
    assert_equal "What am I proud of?", sections.first["items"].last["label"]
    assert_not sections.any? { |s| s["kind"] == "script" }

    patch "/api/step_works/#{work.id}", params: { definition: { sections: [{ id: "x", kind: "nope" }] } }, as: :json
    assert_response :unprocessable_entity
  end

  test "mark done, do it again, delete" do
    work = StepWork.start!(@sam, StepTool.find("step8-amends-list"))
    patch "/api/step_works/#{work.id}", params: { status: "done" }, as: :json
    assert work.reload.done_at
    post "/api/step_works", params: { copy_of: work.id }, as: :json
    assert_response :created
    assert_equal 2, @sam.step_works.count
    delete "/api/step_works/#{work.id}"
    assert_equal 1, @sam.step_works.count
  end

  test "step work can be sent to a sponsor, encrypted" do
    pat = User.create!(name: "Pat", email: "pat@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current)
    s = Sponsorship.create!(sponsor: pat, sponsee: @sam, status: "active", started_on: Date.current)
    post "/api/sponsorship_shares", params: { sponsorship_ids: [s.id], kind: "step_work", on: Date.current.iso8601,
                                              title: "Step 4: Big Book four columns", body: "RESENTMENTS\n1. I'm resentful at: Dad" }, as: :json
    assert_response :created
    raw = SponsorshipShare.connection.select_value("SELECT body FROM sponsorship_shares WHERE sponsorship_id = #{s.id}")
    assert_not_includes raw, "Dad"
    assert_equal "Step 4: Big Book four columns", SponsorshipShare.last.title
  end
end
