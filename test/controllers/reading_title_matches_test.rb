require "test_helper"

# The new-reading form's title search and "Adopt"
class ReadingTitleMatchesTest < ActionDispatch::IntegrationTest
  UA = { "User-Agent" => "Mozilla/5.0 Chrome", "Accept" => "application/json" }.freeze

  setup do
    Rails.application.reload_routes_unless_loaded
    @me = User.create!(email: "me-tm@example.com", name: "Me", password: "password123", confirmed: true)
    @other = User.create!(email: "other-tm@example.com", name: "Other", password: "password123", confirmed: true)
    @older = Reading.create!(title: "Acceptance Was the Answer", content: "<p>Older words</p>", user: @other,
                             meetingName: "Tuesday Night", meetingDate: Date.new(2025, 3, 4), meetingTime: "19:00",
                             topic: "<ul><li>Acceptance at work</li><li>Letting go</li></ul>", published_at: 1.year.ago)
    @newer = Reading.create!(title: "acceptance was the answer", content: "<p>Newer words</p>", user: @other,
                             meetingName: "Sunday Morning", meetingDate: Date.new(2026, 10, 5), published_at: 1.month.ago)
    @their_draft = Reading.create!(title: "Acceptance draft", content: "x", user: @other)
    @my_draft = Reading.create!(title: "Acceptance mine", content: "x", user: @me)
    sign_in @me
  end

  def matches(q)
    get "/readings/title_matches", params: { q: q }, headers: UA
    assert_response :success
    JSON.parse(response.body)
  end

  test "finds every visible reading with the title, newest meeting first, with when it was held" do
    data = matches("acceptance")
    ids = data["matches"].map { |m| m["id"] }
    assert_equal [@newer.id, @older.id], ids & [@newer.id, @older.id]
    assert_includes ids, @my_draft.id
    assert_not_includes ids, @their_draft.id

    older = data["matches"].find { |m| m["id"] == @older.id }
    assert_equal "2025-03-04", older["meeting_date"]
    assert_equal "19:00", older["meeting_time"]
    assert_equal "Tuesday Night", older["meeting_name"]
    assert_equal ["Acceptance at work", "Letting go"], older["topics"]
    assert_equal 2, older["topic_count"]
  end

  test "short queries find nothing, and signing in is required" do
    assert_equal [], matches("a")["matches"]
    sign_out @me
    get "/readings/title_matches", params: { q: "acceptance" }, headers: UA
    assert_response :unauthorized
  end

  test "adopting copies a visible reading's words and topics, and others' drafts stay hidden" do
    get "/readings/#{@older.id}/adoptable", headers: UA
    assert_response :success
    data = JSON.parse(response.body)
    assert_includes data["content_html"], "Older words"
    assert_includes data["topic_html"], "Letting go"

    get "/readings/#{@their_draft.id}/adoptable", headers: UA
    assert_response :not_found
  end

  test "a new reading remembers the one it was adopted from, only when visible" do
    post "/readings", params: { reading: { title: "Acceptance Was the Answer", content: "<p>Older words</p>", adopted_from_id: @older.id } }, headers: UA
    assert_response :created
    assert_equal @older, Reading.find(JSON.parse(response.body)["id"]).adopted_from

    post "/readings", params: { reading: { title: "Sneaky", content: "x", adopted_from_id: @their_draft.id } }, headers: UA
    assert_nil Reading.find(JSON.parse(response.body)["id"]).adopted_from
  end
end
