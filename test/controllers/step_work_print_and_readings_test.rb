require "test_helper"

# Printing a worksheet from the iPhone home screen app (a 30 minute print link,
# StepWorkPrintsController) and the readings in worksheets that link into the library
# (LibraryLinksController)
class StepWorkPrintAndReadingsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @sam = User.create!(name: "Sam", email: "sam@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current)
    @lee = User.create!(name: "Lee", email: "lee@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current)
    @work = StepWork.start!(@sam, StepTool.find("step1-powerlessness"))
    @work.update!(answers: { "stopping" => ["Only beer, only on weekends"] })
  end

  test "a print link shows the worksheet without signing in, only for a while" do
    sign_in @sam
    post "/api/step_works/#{@work.id}/print_link", as: :json
    assert_response :success
    path = response.parsed_body["path"]
    assert_match %r{\A/worksheet/print/}, path
    sign_out @sam

    get path
    assert_response :success
    assert_includes response.body, "Only beer, only on weekends"
    assert_equal "no-store", response.headers["Cache-Control"]
    assert_match "noindex", response.headers["X-Robots-Tag"]

    travel StepWork::PRINT_LINK_FOR + 1.minute do
      get path
      assert_response :gone
      assert_not_includes response.body, "Only beer"
    end
  end

  test "print links can't be made for, or forged into, someone else's worksheet" do
    sign_in @lee
    post "/api/step_works/#{@work.id}/print_link", as: :json
    assert_response :not_found

    get "/worksheet/print/#{@work.share_token || 'nope'}"
    assert_response :gone
    # A token for the right worksheet but another person is no good either
    forged = StepWork.print_verifier.generate([@work.id, @lee.id], purpose: :print, expires_in: 5.minutes)
    get "/worksheet/print/#{forged}"
    assert_response :gone
  end

  test "every built-in worksheet for a step has a reading list to start with" do
    StepTool.all.each do |t|
      reading = t.definition["sections"].find { |s| s["id"] == "readings" && s["kind"] == "reference" }
      assert reading, "#{t.key} has no Read first"
      assert reading["items"].present?, "#{t.key} has no reading list"
      reading["items"].each { |r| assert_match(/Big Book|12&12|Doctor/, r["label"], t.key) }
    end
  end

  test "a reading list keeps its readings, and only library links" do
    d = StepTool.clean("sections" => [
      { "id" => "readings", "kind" => "reference", "title" => "Read first",
        "items" => [{ "id" => "r1", "label" => "Step One in the 12&12" },
                    { "id" => "r2", "label" => "A pamphlet", "href" => "https://example.com/x" },
                    { "id" => "r3", "label" => "Page 86", "href" => "/library/go?work=bigbook&page=86" },
                    { "id" => "bad id!", "label" => "Dropped" }] },
      { "id" => "empty", "kind" => "reference", "title" => "Nothing in it" },
    ])
    reading = d["sections"].sole
    assert_equal %w[r1 r2 r3], reading["items"].map { |r| r["id"] }
    assert_nil reading["items"][1]["href"]
    assert_equal "/library/go?work=bigbook&page=86", reading["items"][2]["href"]
  end

  test "pages keep their titles and lines, and a worksheet can be set to show on one page" do
    d = StepTool.clean("layout" => "one_page", "sections" => [
      { "id" => "a", "kind" => "questions", "title" => "A", "page" => "  Looking back  ", "page_line" => "Take your time.", "items" => [{ "id" => "q1", "label" => "What happened?" }] },
      { "id" => "b", "kind" => "note", "body" => "x", "page" => "y" * 300, "page_line" => "z" * 400 },
    ])
    assert_equal "one_page", d["layout"]
    a, b = d["sections"]
    assert_equal ["Looking back", "Take your time."], a.values_at("page", "page_line")
    assert_equal [200, 300], [b["page"].size, b["page_line"].size]
    assert_nil StepTool.clean("layout" => "sideways", "sections" => [{ "id" => "n", "kind" => "note", "body" => "x" }])["layout"]

    sign_in @sam
    patch api_step_work_path(@work), params: { definition: d }, as: :json
    assert_response :success
    assert_equal "Looking back", @work.reload.definition["sections"].first["page"]
    assert_equal "one_page", @work.definition["layout"]
  end

  test "what was read is saved with the answers, and how they read it in their settings" do
    sign_in @sam
    work = @work
    patch api_step_work_path(work), params: { answers: { readings: { r1: "2026-11-05" } }, settings: { layout: "one_page", at_page: "control", from: "Forged" } }, as: :json
    assert_response :success
    work.reload
    assert_equal({ "r1" => "2026-11-05" }, work.answers["readings"])
    assert_equal "one_page", work.settings["layout"]
    assert_equal "control", work.settings["at_page"]
    assert_nil work.settings["from"]
    raw = StepWork.connection.select_value("SELECT answers FROM step_works WHERE id = #{work.id}")
    assert_not_includes raw.to_s, "2026-11-05"
  end

  test "a reading goes to that chapter or printed page in the library" do
    Book.where(work_key: %w[bigbook twelve_and_twelve]).destroy_all
    book = Book.create!(title: "Alcoholics Anonymous", slug: "alcoholics-anonymous", work_key: "bigbook", edition: "4e", language: "en", publicly_accessible: true)
    book.chapters.create!(title: "We Agnostics", slug: "we-agnostics", index: 0, first_page: 44, last_page: 57, content: "x")
    book.chapters.create!(title: "How It Works", slug: "how-it-works", index: 1, first_page: 58, last_page: 71, content: "x")

    get "/library/go", params: { work: "bigbook", chapter: "we-agnostics" }
    assert_redirected_to "/books/alcoholics-anonymous/chapters/we-agnostics"
    get "/library/go", params: { work: "bigbook", page: "63" }
    assert_redirected_to "/books/alcoholics-anonymous/chapters/how-it-works#page-63"
    get "/library/go", params: { work: "bigbook", page: "900" }
    assert_redirected_to "/library/alcoholics-anonymous"
    get "/library/go", params: { work: "twelve_and_twelve", chapter: "step-one" }
    assert_redirected_to "/library"

    book.update!(publicly_accessible: false)
    get "/library/go", params: { work: "bigbook", chapter: "we-agnostics" }
    assert_redirected_to "/library"
  end
end
