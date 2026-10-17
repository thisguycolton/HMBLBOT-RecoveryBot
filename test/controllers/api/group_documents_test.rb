require "test_helper"

class Api::GroupDocumentsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @boss = User.create!(email: "boss@example.com", name: "Boss", password: "password123", confirmed: true, admin: true)
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @other = User.create!(email: "other@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @elsewhere = Group.create!(title: "Night Owls", time_zone: "America/Phoenix")
    @elsewhere.memberships.create!(user: @other, role: "member")

    @public = @group.documents.create!(title: "Our format", kind: "format", body: "Welcome **everyone**", visibility: "public")
    @members = @group.documents.create!(title: "Guidelines", kind: "guidelines", body: "Be kind", visibility: "members")
    @keepers = @group.documents.create!(title: "Treasurer notes", kind: "treasury", body: "Reserve", visibility: "keepers")
    @draft = @group.documents.create!(title: "Draft", kind: "other", visibility: "public", status: "draft")
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def titles = response.parsed_body["documents"].map { |d| d["title"] }
  def path(*rest) = ["/api/groups/#{@group.slug}/documents", *rest].join("/")

  test "visitors and non-members only see Public documents" do
    get path, as: :json
    assert_response :success
    assert_equal ["Our format"], titles
    assert_equal false, response.parsed_body["can_edit"]

    get path(@public.id), as: :json
    assert_response :success
    assert_equal "Welcome **everyone**", response.parsed_body["body"]
    get path(@members.id), as: :json
    assert_response :not_found

    sign_in @other
    get path, as: :json
    assert_equal ["Our format"], titles
    get path(@members.id), as: :json
    assert_response :not_found
  end

  test "members also see Members documents, not drafts or keepers-only ones" do
    sign_in @member
    get path, as: :json
    assert_equal ["Guidelines", "Our format"], titles.sort
    assert_equal false, response.parsed_body["can_edit"]
    get path(@keepers.id), as: :json
    assert_response :not_found
    get path(@draft.id), as: :json
    assert_response :not_found
  end

  test "record keepers and admins see everything" do
    [@keeper, @leader, @boss].each do |user|
      sign_in user
      get path, as: :json
      assert_equal 4, titles.size
      assert_equal true, response.parsed_body["can_edit"]
    end
  end

  test "search covers titles and text" do
    sign_in @member
    get path, params: { q: "kind" }, as: :json
    assert_equal ["Guidelines"], titles
  end

  test "only record keepers write documents" do
    post path, params: { document: { title: "Nope" } }, as: :json
    assert_response :unauthorized

    sign_in @member
    post path, params: { document: { title: "Nope" } }, as: :json
    assert_response :forbidden
    patch path(@members.id), params: { document: { body: "Changed" } }, as: :json
    assert_response :forbidden

    sign_in @keeper
    post path, params: { document: { title: "Group guidelines", kind: "guidelines", body: "# Hi", visibility: "public" } }, as: :json
    assert_response :created
    created = GroupDocument.find(response.parsed_body["id"])
    assert_equal [@keeper, "public", "current"], [created.created_by, created.visibility, created.status]

    patch path(@members.id), params: { document: { body: "Be kinder", pinned: true } }, as: :json
    assert_response :success
    assert_equal true, response.parsed_body["pinned"]
    assert_equal 1, @members.versions.count
    assert_equal "Be kind", @members.versions.first.body

    patch path(@members.id), params: { document: { title: "" } }, as: :json
    assert_response :unprocessable_entity
  end

  test "a record keeper of another group can't touch this one" do
    sign_in @other
    post path, params: { document: { title: "Nope" } }, as: :json
    assert_response :not_found
  end

  test "a file with no title takes its name; files are served from behind the same rules" do
    sign_in @keeper
    upload = Rack::Test::UploadedFile.new(file_fixture("avatar.png"), "image/png")
    post path, params: { document: { file: upload, kind: "outreach" } }
    assert_response :created
    doc = GroupDocument.find(response.parsed_body["id"])
    assert_equal "avatar", doc.title
    assert_equal({ "name" => "avatar.png", "type" => "image/png", "size" => doc.file.byte_size, "inline" => true }, response.parsed_body["file"])

    get path(doc.id, "file")
    assert_response :success
    assert_match "inline", response.headers["Content-Disposition"]
    assert_equal "image/png", response.media_type

    get path(doc.id, "file"), params: { download: 1 }
    assert_match "attachment", response.headers["Content-Disposition"]

    sign_in @member
    get path(doc.id, "file")
    assert_response :success
    sign_out @member
    get path(doc.id, "file")
    assert_response :not_found

    sign_in @keeper
    post path, params: { document: { file: Rack::Test::UploadedFile.new(StringIO.new("MZ"), "application/octet-stream", original_filename: "run.exe") } }
    assert_response :unprocessable_entity
  end

  test "history is for members; restoring is for record keepers" do
    @members.revise({ body: "Be kinder" }, @keeper)
    version = @members.versions.first

    get path(@public.id, "versions"), as: :json
    assert_response :unauthorized

    sign_in @member
    get path(@members.id, "versions"), as: :json
    assert_response :success
    assert_equal ["Be kind"], response.parsed_body["versions"].map { |v| v["body"] }
    post path(@members.id, "versions/#{version.id}/restore"), as: :json
    assert_response :forbidden

    sign_in @keeper
    post path(@members.id, "versions/#{version.id}/restore"), as: :json
    assert_response :success
    assert_equal "Be kind", @members.reload.body
    assert_equal 2, @members.versions.count
  end

  test "only group admins delete" do
    sign_in @keeper
    delete path(@members.id), as: :json
    assert_response :forbidden
    assert GroupDocument.exists?(@members.id)

    sign_in @leader
    delete path(@members.id), as: :json
    assert_response :no_content
    assert_not GroupDocument.exists?(@members.id)
  end

  test "an admin makes a member a record keeper" do
    membership = @group.memberships.find_by(user: @member)
    sign_in @member
    patch "/api/groups/#{@group.slug}/memberships/#{membership.id}", params: { can_keep_records: true }, as: :json
    assert_response :forbidden

    sign_in @leader
    patch "/api/groups/#{@group.slug}/memberships/#{membership.id}", params: { can_keep_records: true }, as: :json
    assert_response :no_content
    assert @group.reload.records_editable_by?(@member)

    get "/api/groups/#{@group.slug}", as: :json
    assert_equal [true], response.parsed_body["members"].select { |m| m["name"] == "Mo" }.map { |m| m["can_keep_records"] }
  end

  test "the page's documents block lists what the viewer may see" do
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_equal ["Our format"], response.parsed_body.dig("context", "documents").map { |d| d["title"] }
    assert_equal false, response.parsed_body.dig("context", "viewer", "can_keep_records")

    sign_in @leader
    patch "/api/groups/#{@group.slug}/page", params: { page: { blocks: [{ type: "documents", kind: "format", limit: 3, pinned_only: "1" }, { type: "documents", kind: "bogus", limit: 99 }] } }, as: :json
    assert_response :success
    assert_equal [["format", 3, true], ["all", 5, false]], @group.reload.page_blocks.map { |b| [b["kind"], b["limit"], b["pinned_only"]] }
    assert_equal 4, response.parsed_body.dig("context", "documents").size

    sign_in @keeper
    get "/api/groups/#{@group.slug}/page", as: :json
    assert_equal true, response.parsed_body.dig("context", "viewer", "can_keep_records")
  end

  test "the editor saves HTML, which is cleaned, and the document says what format it is in" do
    sign_in @keeper
    html = %(<h2>Format</h2><p>Hello <strong>all</strong><script>alert(1)</script></p>)
    patch path(@members.id), params: { document: { body: html, body_format: "html" } }, as: :json
    assert_response :success
    assert_equal "html", response.parsed_body["body_format"]
    assert_equal "<h2>Format</h2><p>Hello <strong>all</strong></p>", response.parsed_body["body"]
    assert_equal ["Be kind", "html"], @members.versions.first.then { |v| [v.body, v.body_format] }

    sign_in @member
    get path(@members.id, "versions"), as: :json
    assert_equal ["html"], response.parsed_body["versions"].map { |v| v["body_format"] }
  end

  test "a document written as HTML shows visitors cleaned HTML only" do
    doc = @group.documents.create!(title: "Public format", kind: "format", visibility: "public", body: %(<p onclick="x()">Hi</p><script>1</script>))
    get path(doc.id), as: :json
    assert_equal "<p>Hi</p>", response.parsed_body["body"]
  end
end
