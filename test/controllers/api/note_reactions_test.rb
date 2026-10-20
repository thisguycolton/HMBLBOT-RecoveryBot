require "test_helper"

class Api::NoteReactionsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @lee = User.create!(email: "lee@example.com", name: "Lee R.", password: "password123", confirmed: true)
    @mo = User.create!(email: "mo@example.com", name: "Mo", password: "password123", confirmed: true)
    @oz = User.create!(email: "oz@example.com", name: "Oz", password: "password123", confirmed: true)
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  test "one reaction per person, changeable, and the author hears about the first" do
    note = @lee.timeline_notes.create!(body: "Day 90", visibility: "public")
    sign_in @mo

    assert_difference -> { @lee.notifications.count }, 1 do
      put "/api/timeline_notes/#{note.id}/reaction", params: { kind: "hugs" }, as: :json
    end
    assert_response :success
    assert_equal "hugs", response.parsed_body["my_reaction"]
    assert_equal({ "like" => 0, "love" => 0, "hugs" => 1 }, response.parsed_body["reactions"])
    assert_equal "Mo sent hugs for your note", @lee.notifications.last.title

    assert_no_difference -> { @lee.notifications.count } do
      put "/api/timeline_notes/#{note.id}/reaction", params: { kind: "love" }, as: :json
    end
    assert_equal({ "like" => 0, "love" => 1, "hugs" => 0 }, response.parsed_body["reactions"])
    assert_equal [["Mo", "love"]], response.parsed_body["reactors"].map { |p| [p["name"], p["reaction"]] }
    assert_equal 1, note.reactions.count

    put "/api/timeline_notes/#{note.id}/reaction", params: { kind: "shrug" }, as: :json
    assert_response :unprocessable_entity

    delete "/api/timeline_notes/#{note.id}/reaction", as: :json
    assert_nil response.parsed_body["my_reaction"]
    assert_equal 0, note.reactions.count
  end

  test "people can only react to notes they can see" do
    secret = @lee.timeline_notes.create!(body: "Just me", visibility: "private")
    friends = @lee.timeline_notes.create!(body: "Followers", visibility: "followers")
    sign_in @mo

    put "/api/timeline_notes/#{secret.id}/reaction", params: { kind: "like" }, as: :json
    assert_response :not_found
    put "/api/timeline_notes/#{friends.id}/reaction", params: { kind: "like" }, as: :json
    assert_response :not_found

    @mo.follows_given.create!(followed: @lee)
    put "/api/timeline_notes/#{friends.id}/reaction", params: { kind: "like" }, as: :json
    assert_response :success

    # A private note shared to a group is seen there by its members
    group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    group.memberships.create!(user: @lee, role: "admin")
    group.memberships.create!(user: @mo, role: "member")
    secret.share_to!([group])
    put "/api/timeline_notes/#{secret.id}/reaction", params: { kind: "love" }, as: :json
    assert_response :success
  end

  test "reposting puts a Members note on your timeline, crediting its author, once" do
    note = @lee.timeline_notes.create!(body: "Keep coming back", visibility: "public")
    sign_in @mo

    assert_difference -> { @lee.notifications.count }, 1 do
      post "/api/timeline_notes/#{note.id}/repost", params: { visibility: "followers" }, as: :json
    end
    assert_response :created
    repost = response.parsed_body
    assert_equal "repost", repost["kind"]
    assert_equal "followers", repost["visibility"]
    assert_equal "Mo", repost["author"]["name"]
    assert_equal "Keep coming back", repost["note"]["body"]
    assert_equal "Lee R.", repost["note"]["author"]["name"]
    assert repost["note"]["reposted"]
    assert_equal 1, repost["note"]["repost_count"]

    assert_no_difference -> { TimelineNote.count } do
      post "/api/timeline_notes/#{note.id}/repost", as: :json
    end

    # It's on Mo's profile for Mo's followers, and reacting to it reacts to the original
    @oz.follows_given.create!(followed: @mo)
    sign_in @oz
    get "/api/people/#{@mo.username}"
    feed = response.parsed_body["context"]["feed"]
    assert_equal ["repost"], feed.map { |i| i["kind"] }
    put "/api/timeline_notes/#{feed.first['id']}/reaction", params: { kind: "like" }, as: :json
    assert_response :success
    assert_equal note.id, response.parsed_body["id"]
    assert_equal 1, note.reactions.count

    # Its author can't repost their own
    sign_in @lee
    post "/api/timeline_notes/#{note.id}/repost", as: :json
    assert_response :unprocessable_entity

    sign_in @mo
    delete "/api/timeline_notes/#{note.id}/repost", as: :json
    assert_response :success
    assert_not note.reposts.exists?
  end

  test "only Members notes can be reposted, and narrowing or deleting one takes its reposts away" do
    friends = @lee.timeline_notes.create!(body: "Followers only", visibility: "followers")
    @mo.follows_given.create!(followed: @lee)
    sign_in @mo

    get "/api/people/#{@lee.username}"
    assert_equal false, response.parsed_body["context"]["feed"].first["can_repost"]
    post "/api/timeline_notes/#{friends.id}/repost", as: :json
    assert_response :unprocessable_entity
    assert_equal "You can only repost a note shared with Members.", response.parsed_body["error"]

    friends.update!(visibility: "public")
    post "/api/timeline_notes/#{friends.id}/repost", params: { visibility: "public" }, as: :json
    assert_response :created
    repost_id = response.parsed_body["id"]

    # A repost keeps its original's words; only who sees it changes
    patch "/api/timeline_notes/#{repost_id}", params: { note: { body: "Changed", visibility: "followers" } }, as: :json
    assert_response :success
    assert_equal "Followers only", response.parsed_body["note"]["body"]
    assert_equal "followers", TimelineNote.find(repost_id).visibility

    friends.update!(visibility: "followers")
    assert_not TimelineNote.exists?(repost_id)

    friends.update!(visibility: "public")
    post "/api/timeline_notes/#{friends.id}/repost", as: :json
    friends.destroy!
    assert_equal 0, @mo.timeline_notes.count
  end
end
