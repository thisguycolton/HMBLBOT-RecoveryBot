require "test_helper"

# Site Admin > HostDeck scripts (HostScriptTemplate), and host coordinators copying one into the
# group's documents from Set up HostDeck
class Api::HostScriptTemplatesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @boss = User.create!(email: "boss@example.com", password: "password123", confirmed: true, name: "Boss", admin: true)
    @coordinator = User.create!(email: "coord@example.com", password: "password123", confirmed: true, name: "Cam")
    @host = User.create!(email: "host@example.com", password: "password123", confirmed: true, name: "Hal")
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @coordinator, role: "member", can_schedule_hosts: true)
    @group.memberships.create!(user: @host, role: "member", can_host: true)
    @meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: 1, start_minute: 420)
    # what the migration adds
    @built_in = HostScriptTemplate.create!(key: "online_meeting", name: "Online meeting host format", body: HostScriptTemplate.built_in_body("online_meeting"))
  end

  teardown { ENV["ADMIN_EMAILS"] = @env }

  test "the built-in script is generalized from The Acid Test's format, with its sections and dynamic values" do
    body = @built_in.body
    assert_no_match(/acid test/i, body)
    assert_no_match(/court_verifications|homegroup\.online|Phoenix/i, body)
    assert_equal ["5 Minutes Before the Meeting - Non-AA Announcements", "Opening", "AA Announcements", "Opening Readings", "Newcomers & Milestones",
                  "Topicificator", "Meeting Format", "Sharing", "Burning Desires", "Closing", "Closing Reading", "Closing Statements"], @built_in.section_titles
    %w[group meeting service_host service_hiw service_traditions service_closing milestones].each { |v| assert_includes body, "{{ #{v} }}" }
    assert_includes body, %(data-hc-form="milestones")
    assert_includes body, %(data-kind="activity")
    assert_includes body, %(data-when="topics")
    assert_includes body, %(data-cue="end-5")
  end

  test "only suite admins manage them" do
    sign_in @coordinator
    get "/api/admin/host_script_templates", as: :json
    assert_response :forbidden
  end

  test "admins edit, add, copy, rename, hide, reset and delete scripts" do
    sign_in @boss
    get "/api/admin/host_script_templates", as: :json
    assert_response :success
    assert_equal [["Online meeting host format", true]], response.parsed_body["templates"].map { |t| t.values_at("name", "built_in") }

    patch "/api/admin/host_script_templates/#{@built_in.id}", params: { template: { name: "Online format", body: "<p>Hi {{ meeting }}</p><script>x</script>" } }, as: :json
    assert_response :success
    assert_equal "Online format", response.parsed_body.dig("template", "name")
    assert_equal "<p>Hi {{ meeting }}</p>", @built_in.reload.body
    assert_equal @boss, @built_in.updated_by

    post "/api/admin/host_script_templates/#{@built_in.id}/reset", as: :json
    assert_response :success
    assert_equal DocumentHtml.sanitize(HostScriptTemplate.built_in_body("online_meeting")), @built_in.reload.body

    delete "/api/admin/host_script_templates/#{@built_in.id}", as: :json
    assert_response :unprocessable_entity

    post "/api/admin/host_script_templates", params: { template: { name: "Speaker meeting", body: "<p>Welcome</p>" } }, as: :json
    assert_response :created
    speaker = response.parsed_body["template"]
    assert speaker["hidden"], "a new script waits to be offered"

    post "/api/admin/host_script_templates", params: { copy_of: @built_in.id }, as: :json
    assert_response :created
    assert_equal "Copy of Online format", response.parsed_body.dig("template", "name")
    assert_equal 12, response.parsed_body.dig("template", "sections").size

    patch "/api/admin/host_script_templates/#{speaker['id']}", params: { template: { name: "Speaker meeting format", hidden: false } }, as: :json
    assert_response :success
    assert_not response.parsed_body.dig("template", "hidden")

    delete "/api/admin/host_script_templates/#{speaker['id']}", as: :json
    assert_response :no_content
    assert_equal 2, HostScriptTemplate.count
  end

  test "host coordinators see the offered scripts and copy one into the group's documents as a meeting's script" do
    HostScriptTemplate.create!(name: "Draft", body: "<p>x</p>", hidden: true)
    sign_in @host
    get "/api/groups/#{@group.slug}/hosting/script_templates", as: :json
    assert_response :forbidden

    sign_in @coordinator
    get "/api/groups/#{@group.slug}/hosting/script_templates", as: :json
    assert_response :success
    assert_equal ["Online meeting host format"], response.parsed_body["templates"].map { |t| t["name"] }

    post "/api/groups/#{@group.slug}/hosting/script_templates", params: { template_id: @built_in.id, title: "Sunrise format" }, as: :json
    assert_response :created
    doc = @group.documents.find(response.parsed_body.dig("document", "id"))
    assert_equal ["Sunrise format", "format", "hosts", "current"], [doc.title, doc.kind, doc.visibility, doc.status]
    assert_equal 13, response.parsed_body.dig("document", "sections")
    assert_equal 1, doc.versions.count
    assert_includes doc.body, "{{ service_hiw }}"

    # it shows in Set up HostDeck's list, and saving the kit makes it the script
    put "/api/groups/#{@group.slug}/hosting/#{@meeting.id}/kit", params: { kit: { scope: "meeting", script_document_id: doc.id, postings: [], readings: [] } }, as: :json
    assert_response :success
    assert_equal doc.id, @group.hosting_kits.find_by(meeting: @meeting).script_document_id

    # the group's copy is its own
    @built_in.update!(body: "<p>Changed</p>")
    assert_includes doc.reload.body, "{{ service_hiw }}"

    post "/api/groups/#{@group.slug}/hosting/script_templates", params: { template_id: HostScriptTemplate.find_by(name: "Draft").id }, as: :json
    assert_response :not_found
  end
end
