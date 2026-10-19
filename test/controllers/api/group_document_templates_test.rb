require "test_helper"

class Api::GroupDocumentTemplatesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
  end

  def path(*rest) = ["/api/groups/#{@group.slug}/document_templates", *rest].join("/")

  test "record keepers set a folder's letterhead and its documents carry it" do
    sign_in @member
    get path, as: :json
    assert_equal GroupDocument::KINDS, response.parsed_body["templates"].map { |t| t["kind"] }
    patch path("format"), params: { template: { header_text: "Nope" } }
    assert_response :forbidden

    sign_in @keeper
    patch path("format"), params: { template: { mark: "seal", header_text: "{{group}}", footer_text: "For members", seal: fixture_file_upload(Rails.root.join("test/fixtures/files/avatar.png"), "image/png") } }
    assert_response :success
    assert_match %r{/rails/active_storage/}, response.parsed_body["mark_url"]

    doc = @group.documents.create!(title: "Format", kind: "format", body: "<p>Hi</p>", created_by: @keeper)
    get "/api/groups/#{@group.slug}/documents/#{doc.id}", as: :json
    assert_equal ["{{group}}", "For members"], response.parsed_body["letterhead"].values_at("header_text", "footer_text")
  end
end
