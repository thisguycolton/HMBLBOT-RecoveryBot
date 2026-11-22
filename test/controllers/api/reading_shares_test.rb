require "test_helper"

class Api::ReadingSharesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @poster = User.create!(email: "poster@example.com", name: "Pat P.", password: "password123", confirmed: true)
    @tina = User.create!(email: "tina@example.com", name: "Tina B.", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @reading = Reading.create!(title: "On acceptance", user: @poster, published_at: 1.day.ago)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  def share!(who, body: "It helped me today", anonymous: true)
    sign_in who
    post "/api/readings/#{@reading.id}/shares", params: { share: { body: body, anonymous: anonymous } }, as: :json
    response.parsed_body
  end

  test "an anonymous share never names its writer to anyone else, not even the poster who approves it" do
    assert_difference -> { @poster.notifications.count }, 1 do
      share!(@tina)
    end
    assert_response :created
    mine = response.parsed_body
    assert mine["mine"]
    assert mine["anonymous"]
    assert_equal "pending", mine["status"]
    assert_equal "A member", mine["name"]
    assert_nil mine["author"]

    note = @poster.notifications.last
    assert_equal "reading_share.pending", note.kind
    assert_no_match(/Tina/, note.title)
    assert_nil note.body, "no words go out, so nothing lands on a lock screen"

    # Mo doesn't see it until it's approved
    sign_in @mo
    get "/api/readings/#{@reading.id}/shares"
    assert_equal [], response.parsed_body["shares"]

    # The poster sees it waiting, still as "A member", and approves it
    sign_in @poster
    get "/api/readings/#{@reading.id}/shares"
    body = response.parsed_body
    assert body["can_moderate"]
    assert_equal 1, body["pending"]
    waiting = body["shares"].first
    assert_equal "A member", waiting["name"]
    assert_nil waiting["author"]
    refute_includes response.body, "Tina"
    refute_includes response.body, "tina@example.com"
    refute_includes response.body, @tina.username
    post "/api/reading_shares/#{waiting['id']}/approve", as: :json
    assert_response :success

    sign_in @mo
    get "/api/readings/#{@reading.id}/shares"
    seen = response.parsed_body["shares"].first
    assert_equal "It helped me today", seen["body"]
    assert_equal "A member", seen["name"]
    refute seen["mine"]
    assert_nil seen["status"], "only its writer and approvers see its state"
    refute_includes response.body, "Tina"
    refute_includes response.body, @tina.id.to_s + ","
  end

  test "a named share shows the writer, and the writer can switch it either way" do
    s = share!(@tina, anonymous: false)
    assert_equal "Tina B.", s["name"]
    assert_equal @tina.username, s["author"]["username"]

    patch "/api/reading_shares/#{s['id']}", params: { share: { anonymous: true } }, as: :json
    assert_equal "A member", response.parsed_body["name"]
    assert_equal "pending", response.parsed_body["status"]
  end

  test "an edit sends an approved share back for approval; the poster's own shares skip it" do
    s = share!(@tina)
    ReadingShare.find(s["id"]).approve!(@poster)
    patch "/api/reading_shares/#{s['id']}", params: { share: { body: "Changed my mind" } }, as: :json
    assert_equal "pending", response.parsed_body["status"]
    assert response.parsed_body["edited"]

    own = share!(@poster)
    assert_equal "approved", own["status"]
  end

  test "declining hides it from everyone but its writer, who sees the reason" do
    s = share!(@tina)
    sign_in @mo
    post "/api/reading_shares/#{s['id']}/decline", params: { reason: "nope" }, as: :json
    assert_response :not_found, "Mo can't see a waiting share, let alone decline it"

    sign_in @poster
    post "/api/reading_shares/#{s['id']}/decline", params: { reason: "Please keep it to your own story" }, as: :json
    assert_equal "declined", response.parsed_body["status"]

    sign_in @tina
    get "/api/readings/#{@reading.id}/shares"
    mine = response.parsed_body["shares"].first
    assert_equal "declined", mine["status"]
    assert_equal "Please keep it to your own story", mine["decline_reason"]
  end

  test "a group's reading: only its members and hosts see shares, and its admins can approve" do
    group = Group.create!(title: "Lantern Street", time_zone: "America/Phoenix")
    @reading.update!(group: group)
    admin = User.create!(email: "admin@example.com", name: "Ada", password: "password123", confirmed: true)
    group.memberships.create!(user: admin, role: "admin")
    group.memberships.create!(user: @tina, role: "member")

    sign_in @mo
    get "/api/readings/#{@reading.id}/shares"
    assert_response :not_found, "Mo isn't in the group"

    s = share!(@tina)
    sign_in admin
    post "/api/reading_shares/#{s['id']}/approve", as: :json
    assert_response :success
  end

  test "signed-out visitors get nothing, and shares can be turned off" do
    get "/api/readings/#{@reading.id}/shares", as: :json
    assert_response :unauthorized

    sign_in @poster
    patch "/api/readings/#{@reading.id}/shares/setting", params: { shares_off: true }, as: :json
    assert response.parsed_body["shares_off"]
    share!(@tina)
    assert_response :forbidden

    sign_in @tina
    patch "/api/readings/#{@reading.id}/shares/setting", params: { shares_off: false }, as: :json
    assert_response :forbidden
  end

  test "two shares an hour at most" do
    share!(@tina, body: "one")
    share!(@tina, body: "two")
    share!(@tina, body: "three")
    assert_response :too_many_requests
  end

  test "reporting an anonymous share keeps its writer hidden from the admins" do
    s = share!(@tina)
    ReadingShare.find(s["id"]).approve!(@poster)
    admin = User.create!(email: "site@example.com", name: "Site", password: "password123", confirmed: true, admin: true)
    ENV["ADMIN_EMAILS"] = "site@example.com"

    sign_in @mo
    post "/api/user_reports", params: { subject_type: "reading_share", subject_id: s["id"], reason: "Rude" }, as: :json
    assert_response :created
    assert_equal "Mo reported an anonymous share", admin.notifications.last.title

    sign_in admin
    get "/api/admin/user_reports"
    report = response.parsed_body["reports"].first
    assert_equal "A member", report["user"]["name"]
    assert_nil report["user"]["email"]
    assert_equal "/readings/#{@reading.id}#shares", report["reading_path"]
    refute_includes response.body, "tina@example.com"
  ensure
    ENV.delete("ADMIN_EMAILS")
  end

  test "deleting an account deletes its shares" do
    share!(@tina)
    assert_difference -> { ReadingShare.count }, -1 do
      @tina.destroy!
    end
  end
end
