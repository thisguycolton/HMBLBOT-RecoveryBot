require "test_helper"

# The Docs (/docs, /about, /history; Api::DocsController): public reading limited by each page's
# audience and status, search, and editing for site admins only, with history kept as they save
class DocsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @admin = User.create!(name: "Boss", email: "boss@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current, admin: true)
    @sam = User.create!(name: "Sam", email: "sam@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current)
    @section = DocSection.create!(title: "Group tools", position: 1)
    @chat = @section.pages.create!(title: "Group chat", summary: "Talk between meetings.", body: "## Mentions\n\nType **@** to mention someone.\n", position: 1)
    @members = @section.pages.create!(title: "Members page", body: "Only for members.", audience: "members", position: 2)
    @draft = @section.pages.create!(title: "Unfinished", body: "Not yet.", status: "draft", position: 3)
    @admins = @section.pages.create!(title: "Admin stuff", body: "Admins.", audience: "admins", position: 4)
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  test "the drafts in db/docs import once and never overwrite edits" do
    DocSection.destroy_all
    added = DocsImport.run
    assert_operator added[:pages], :>=, 50
    about = DocPage.find_by!(path_alias: "about")
    assert_equal "About RecoveryBot", about.title
    about.update!(body: "Edited")
    assert_equal({ sections: 0, pages: 0, refreshed: 0 }, DocsImport.run)
    assert_equal "Edited", about.reload.body
    assert DocPage.where(audience: "admins").joins(:section).where(doc_sections: { slug: "site-admin" }).count.positive?
    assert_not DocPage.where("body ILIKE ?", "%court%").exists?, "Court verification stays out of the docs"
  end

  test "refresh brings newer draft text only to pages nobody has touched" do
    DocSection.destroy_all
    DocsImport.run
    untouched = DocPage.find_by!(path_alias: "history")
    reviewed = DocPage.joins(:section).find_by!(doc_sections: { slug: "group-tools" }, slug: "group-chat")
    edited = DocPage.find_by!(path_alias: "about")
    [untouched, reviewed, edited].each { |p| p.update_columns(body: "Old draft") }
    reviewed.update!(reviewed_at: Time.current, reviewed_by: @admin)
    edited.save_edit({ body: "Colton's words" }, @admin)

    result = DocsImport.run(refresh: true)
    assert_operator result[:refreshed], :>=, 1
    assert_not_equal "Old draft", untouched.reload.body
    assert_equal "Old draft", reviewed.reload.body
    assert_equal "Colton's words", edited.reload.body
  end

  test "refresh[reviewed] also updates reviewed pages whose words nobody changed, keeping the old text" do
    DocSection.destroy_all
    DocsImport.run
    reviewed = DocPage.joins(:section).find_by!(doc_sections: { slug: "group-tools" }, slug: "group-chat")
    edited = DocPage.find_by!(path_alias: "about")
    reviewed.update_columns(body: "Old draft")
    reviewed.mark_reviewed!(true, @admin)
    reviewed.save_edit({ status: "published" }, @admin) # ticking Reviewed saves the page too, without changing its words
    edited.save_edit({ body: "Colton's words" }, @admin)

    DocsImport.run(refresh: :reviewed)
    reviewed.reload
    assert_not_equal "Old draft", reviewed.body
    assert_nil reviewed.reviewed_at, "it goes back on the review list"
    assert_equal "Old draft", reviewed.versions.first.body, "History keeps what was there, so Put back restores it"
    assert_equal "Colton's words", edited.reload.body
  end

  test "every picture the drafts point to is in public/docs-images" do
    missing = Dir[Rails.root.join("db/docs/**/*.md")].flat_map do |file|
      File.read(file).scan(%r{\]\((/docs-images/[^) ]+)}).flatten.reject { |src| Rails.root.join("public#{src}").exist? }.map { |src| "#{src} (#{File.basename(file)})" }
    end
    assert_empty missing
  end

  test "the app's pages render for anyone, with the page's own title" do
    get "/docs"
    assert_response :success
    get "/docs/group-tools/group-chat"
    assert_response :success
    assert_includes response.body, "Group chat | RecoveryBot Docs"
    assert_includes response.body, 'content="Talk between meetings."'
  end

  test "signed out: only published pages for everyone" do
    get "/api/docs", as: :json
    titles = response.parsed_body["sections"].first["pages"].map { |p| p["title"] }
    assert_equal ["Group chat"], titles
    assert_equal false, response.parsed_body["editor"]

    get "/api/docs/page", params: { section: "group-tools", page: "group-chat" }, as: :json
    assert_response :success
    assert_equal "## Mentions\n\nType **@** to mention someone.\n", response.parsed_body["page"]["body"]
    assert_nil response.parsed_body["page"]["reviewed_by"]

    get "/api/docs/page", params: { section: "group-tools", page: "members-page" }, as: :json
    assert_response :not_found
  end

  test "members see members pages; site admins see everything" do
    sign_in @sam
    get "/api/docs", as: :json
    assert_equal ["Group chat", "Members page"], response.parsed_body["sections"].first["pages"].map { |p| p["title"] }
    sign_in @admin
    get "/api/docs", as: :json
    assert_equal 4, response.parsed_body["sections"].first["pages"].size
    assert_equal 4, response.parsed_body["to_review"]
  end

  test "previous and next follow the order the reader can see" do
    sign_in @sam
    get "/api/docs/page", params: { section: "group-tools", page: "group-chat" }, as: :json
    assert_nil response.parsed_body["previous"]
    assert_equal "Members page", response.parsed_body["next"]["title"]
  end

  test "about and history by their alias" do
    @section.pages.create!(title: "About RecoveryBot", body: "Hi", path_alias: "about")
    get "/about"
    assert_response :success
    get "/api/docs/page", params: { alias: "about" }, as: :json
    assert_equal "/about", response.parsed_body["page"]["path"]
  end

  test "search finds titles first, then words, with a snippet, and never hidden pages" do
    @section.pages.create!(title: "Chips", body: "Mention your group's chat in the chips page.")
    get "/api/docs/search", params: { q: "chat" }, as: :json
    results = response.parsed_body["results"]
    assert_equal ["Group chat", "Chips"], results.map { |r| r["title"] }
    assert_includes results.last["snippet"], "chat"
    get "/api/docs/search", params: { q: "Not yet" }, as: :json
    assert_empty response.parsed_body["results"]
  end

  test "the top search box lists Help pages" do
    get "/api/search", params: { q: "group ch" }, as: :json
    docs = response.parsed_body["sections"].find { |s| s["key"] == "docs" }
    assert_equal "/docs/group-tools/group-chat", docs["items"].first["url"]
  end

  test "only site admins edit" do
    sign_in @sam
    patch "/api/docs/pages/#{@chat.id}", params: { page: { body: "Hacked" } }, as: :json
    assert_response :forbidden
    post "/api/docs/sections", params: { section: { title: "Mine" } }, as: :json
    assert_response :forbidden
    assert_equal "## Mentions\n\nType **@** to mention someone.\n", @chat.reload.body
  end

  test "editing keeps the text it replaced, once per editing session, and can put it back" do
    sign_in @admin
    patch "/api/docs/pages/#{@chat.id}", params: { page: { body: "One" } }, as: :json
    assert_response :success
    patch "/api/docs/pages/#{@chat.id}", params: { page: { body: "Two" } }, as: :json
    assert_equal 1, @chat.versions.count
    assert_equal "## Mentions\n\nType **@** to mention someone.\n", @chat.versions.first.body

    travel 11.minutes do
      patch "/api/docs/pages/#{@chat.id}", params: { page: { body: "Three" } }, as: :json
    end
    assert_equal %w[Two], [@chat.versions.reload.first.body]

    old = @chat.versions.last
    post "/api/docs/pages/#{@chat.id}/restore", params: { version_id: old.id }, as: :json
    assert_equal old.body, @chat.reload.body
    assert_equal "Three", @chat.versions.reload.reorder(id: :desc).first.body
  end

  test "settings: reviewed, moving to another section and a new address" do
    sign_in @admin
    other = DocSection.create!(title: "Library", position: 2)
    patch "/api/docs/pages/#{@chat.id}", params: { page: { reviewed: true, doc_section_id: other.id, slug: "Chat Room" } }, as: :json
    assert_response :success
    page = response.parsed_body["page"]
    assert page["reviewed"]
    assert_equal "/docs/library/chat-room", page["path"]
    patch "/api/docs/pages/#{@chat.id}", params: { page: { reviewed: false } }, as: :json
    assert_not response.parsed_body["page"]["reviewed"]
  end

  test "new pages start as drafts; sections can only go once they're empty" do
    sign_in @admin
    post "/api/docs/pages", params: { page: { doc_section_id: @section.id, title: "Brand new" } }, as: :json
    assert_response :created
    assert_equal "draft", response.parsed_body["page"]["status"]
    assert_equal 5, response.parsed_body["page"]["position"]

    delete "/api/docs/sections/#{@section.id}", as: :json
    assert_response :unprocessable_entity
    post "/api/docs/sections", params: { section: { title: "Extras" } }, as: :json
    extras = response.parsed_body["section"]
    assert_equal "/docs/extras", extras["path"]
    delete "/api/docs/sections/#{extras['id']}", as: :json
    assert_response :no_content
  end

  test "pictures upload to the page" do
    sign_in @admin
    file = Rack::Test::UploadedFile.new(Rails.root.join("test/fixtures/files/avatar.png"), "image/png")
    post "/api/docs/pages/#{@chat.id}/images", params: { image: file }
    assert_response :created
    assert_match %r{/rails/active_storage/}, response.parsed_body["url"]
    assert_equal 1, @chat.images.count

    text = Rack::Test::UploadedFile.new(Rails.root.join("Gemfile"), "text/plain")
    post "/api/docs/pages/#{@chat.id}/images", params: { image: text }
    assert_response :unprocessable_entity
  end
end
