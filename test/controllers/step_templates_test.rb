require "test_helper"

# Site Admin > Step worksheets (StepTemplate): drafts only admins see, publishing a version that
# new worksheets start from, history, and the YAML built-ins still read while there are none
class StepTemplatesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @admin = User.create!(name: "Boss", email: "boss@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current, admin: true)
    @sam = User.create!(name: "Sam", email: "sam@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current)
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def import_built_ins
    StepTool.from_files.each do |t|
      StepTemplate.create!(key: t.key, step: t.step, steps: t.steps, name: t.name, summary: t.summary, default: t.default?,
                           draft: t.definition, definition: t.definition, version: 1, published_at: Time.current)
                  .versions.create!(number: 1, name: t.name, definition: t.definition)
    end
  end

  test "without templates the built-in files are used; with them, only published, shown ones" do
    assert_includes StepTool.all.map(&:key), "step1-powerlessness"
    import_built_ins
    assert_equal StepTool.from_files.map(&:key).sort, StepTool.all.map(&:key).sort
    StepTemplate.find_by!(key: "step4-instincts").update!(hidden: true)
    StepTemplate.build(by: @admin, step: 4, name: "Never published").save!
    keys = StepTool.all.map(&:key)
    assert_not_includes keys, "step4-instincts"
    assert_not_includes keys, "step4-never-published"
    assert_nil StepTool.find("step4-instincts")
    assert StepTool.find("step4-instincts", hidden: true)
  end

  test "only site admins can use it" do
    sign_in @sam
    get "/api/admin/step_templates", as: :json
    assert_response :forbidden
  end

  test "a draft is only for admins until it's published; members' work keeps its copy" do
    import_built_ins
    sign_in @admin
    t = StepTemplate.find_by!(key: "step1-powerlessness")
    work = StepWork.start!(@sam, StepTool.find(t.key))
    assert_equal 1, work.tool_version

    draft = t.draft.deep_dup
    draft["sections"].first["page"] = "Before you start"
    draft["intro"] = "A new introduction."
    patch "/api/admin/step_templates/#{t.id}", params: { template: { draft: draft, summary: "Shorter" } }, as: :json
    assert_response :success
    assert response.parsed_body["template"]["changed"]
    assert_not_equal "A new introduction.", StepTool.find(t.key).definition["intro"]

    post "/api/admin/step_templates/#{t.id}/publish", as: :json
    assert_response :success
    tool = StepTool.find(t.key)
    assert_equal "A new introduction.", tool.definition["intro"]
    assert_equal "Before you start", tool.definition["sections"].first["page"]
    assert_equal 2, tool.version
    assert_not_equal "A new introduction.", work.reload.definition["intro"]

    get "/api/admin/step_templates", as: :json
    row = response.parsed_body["templates"].find { |x| x["key"] == t.key }
    assert_equal 1, row["started"]
    assert_equal false, row["changed"]

    post "/api/admin/step_templates/#{t.id}/restore", params: { number: 1 }, as: :json
    assert_response :success
    assert_not_equal "A new introduction.", t.reload.draft["intro"]
    assert_equal "A new introduction.", t.definition["intro"]
    assert_equal [1, 2], t.versions.map(&:number)
  end

  test "a broken draft is refused, and a new one can come from a file" do
    sign_in @admin
    post "/api/admin/step_templates", params: { step: 3, name: "Third step prayer" }, as: :json
    assert_response :created
    id = response.parsed_body["template"]["id"]
    patch "/api/admin/step_templates/#{id}", params: { template: { draft: { sections: [{ id: "x", kind: "nope" }] } } }, as: :json
    assert_response :unprocessable_entity

    file = File.read(Rails.root.join("config/step_tools/step2_came_to_believe.yml"))
    post "/api/admin/step_templates", params: { file: file }, as: :json
    assert_response :created
    made = StepTemplate.find(response.parsed_body["template"]["id"])
    assert_equal "step2-came-to-believe", made.key
    post "/api/admin/step_templates", params: { file: file }, as: :json
    assert_equal "step2-came-to-believe-2", response.parsed_body["template"]["key"]

    delete "/api/admin/step_templates/#{id}", as: :json
    assert_response :no_content
  end

  test "one default for each step" do
    import_built_ins
    t = StepTemplate.find_by!(key: "step4-instincts")
    t.update!(default: true)
    assert_equal ["step4-instincts"], StepTemplate.where(default: true, step: 4).pluck(:key)
  end
end
