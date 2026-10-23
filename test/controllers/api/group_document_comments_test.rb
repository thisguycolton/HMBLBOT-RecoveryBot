require "test_helper"

class Api::GroupDocumentCommentsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @friend = User.create!(email: "friend@example.com", name: "Fi", password: "password123", confirmed: true)
    @outsider = User.create!(email: "out@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @group.memberships.create!(user: @friend, role: "member")
    @doc = @group.documents.new(created_by: @keeper)
    @doc.revise({ title: "Format", body: "<p>Read the preamble, then the steps.</p>", visibility: "public" }, @keeper)
  end

  def path(*rest) = ["/api/groups/#{@group.slug}/documents/#{@doc.id}/comments", *rest].join("/")
  def new_comment(body = "Which preamble?") = post(path, params: { body: body, quote: "the preamble", prefix: "Read ", suffix: ", then" }, as: :json)

  test "comments are off until the document turns them on" do
    sign_in @member
    get path, as: :json
    assert_response :forbidden
    new_comment
    assert_response :forbidden

    @doc.update!(comment_mode: "editors")
    new_comment
    assert_response :forbidden
    sign_in @keeper
    new_comment
    assert_response :created

    @doc.update!(comment_mode: "members")
    sign_in @member
    get path, as: :json
    assert_response :success
    assert_equal ["Which preamble?"], response.parsed_body["comments"].map { |c| c["body"] }
    assert_equal false, response.parsed_body["can_resolve"]

    sign_in @outsider
    get path, as: :json
    assert_response :not_found
  end

  test "a comment quotes its words, gets replies, tells the right people, and is resolved" do
    @doc.update!(comment_mode: "members")
    sign_in @member
    assert_difference -> { Notification.where(user: @keeper, kind: "document.comment").count } => 1 do
      new_comment
    end
    assert_response :created
    thread = response.parsed_body
    assert_equal ["the preamble", "Read ", ", then", 1, false], thread.values_at("quote", "prefix", "suffix", "version", "resolved")
    post path, params: { body: "" , quote: "x" }, as: :json
    assert_response :unprocessable_entity
    post path, params: { body: "No words" }, as: :json
    assert_response :unprocessable_entity

    sign_in @friend
    assert_difference -> { Notification.where(user: @member, kind: "document.comment").count } => 1 do
      post path, params: { body: "The long one", parent_id: thread["id"] }, as: :json
    end
    assert_equal ["The long one"], response.parsed_body["replies"].map { |r| r["body"] }
    patch path(thread["id"]), params: { resolved: true }, as: :json
    assert_response :forbidden, "only the thread's writer or an editor resolves it"
    patch path(thread["id"]), params: { body: "Changed" }, as: :json
    assert_response :forbidden

    sign_in @keeper
    patch path(thread["id"]), params: { resolved: true }, as: :json
    assert_response :success
    assert_equal [true, "Kay"], response.parsed_body.values_at("resolved", "resolved_by")

    sign_in @member
    post path, params: { body: "Still unsure", parent_id: thread["id"] }, as: :json
    assert_equal false, response.parsed_body["resolved"], "a reply reopens it"
    patch path(thread["id"]), params: { body: "Which preamble, exactly?" }, as: :json
    assert_equal "Which preamble, exactly?", response.parsed_body["body"]
  end

  test "writers and group admins delete; a thread goes with its replies" do
    @doc.update!(comment_mode: "members")
    sign_in @member
    new_comment
    id = response.parsed_body["id"]
    sign_in @friend
    post path, params: { body: "Me too", parent_id: id }, as: :json
    delete path(id), as: :json
    assert_response :forbidden

    sign_in @leader
    assert_difference -> { GroupDocumentComment.count } => -2 do
      delete path(id), as: :json
    end
    assert_response :no_content
  end
end
