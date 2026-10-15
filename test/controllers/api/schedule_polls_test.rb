require "test_helper"

class Api::SchedulePollsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  include ActionMailer::TestHelper

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "admin@example.com"
    @admin = User.create!(email: "admin@example.com", name: "Colton", password: "password123", confirmed: true, admin: true)
    @helper = User.create!(email: "helper@example.com", name: "Helper", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Member", password: "password123", confirmed: true)
    @day = Time.current.in_time_zone("America/Phoenix").to_date + 2
    Notification.delete_all
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def poll_params(**overrides)
    {
      title: "Workshop", starts_on: @day.iso8601, ends_on: (@day + 6).iso8601, closes_at: "#{(@day + 6).iso8601}T23:00",
      duration_minutes: 60, choices_count: 3, results_visibility: "after_vote",
      blocks: [9, 12, 18, 21].map { |h| { kind: "daily", start: h * 60, end: h * 60 + 60, label: "Meeting" } },
    }.merge(overrides)
  end

  def create_poll(**overrides)
    sign_in @admin
    post "/api/schedule_polls", params: { poll: poll_params(**overrides) }, as: :json
    assert_response :created
    sign_out @admin
    SchedulePoll.find_by!(token: response.parsed_body["token"])
  end

  def at(day_offset, hour, minute = 0) = format("%sT%02d:%02d", (@day + day_offset).iso8601, hour, minute)

  test "only suite admins can create polls, and the page and list need an account" do
    post "/api/schedule_polls", params: { poll: poll_params }, as: :json
    assert_response :unauthorized

    sign_in @member
    post "/api/schedule_polls", params: { poll: poll_params }, as: :json
    assert_response :forbidden
    get "/api/schedule_polls", as: :json
    assert_equal false, response.parsed_body["can_create"]
    sign_out @member

    get "/schedule_polls"
    assert_redirected_to new_user_session_path

    poll = create_poll
    assert_equal 4, poll.blocks.size
    get "/schedule_polls/#{poll.token}"
    assert_response :success
  end

  test "tagging people notifies and emails them, and collaborators can edit but not delete" do
    sign_in @admin
    assert_enqueued_emails 2 do
      post "/api/schedule_polls", params: { poll: poll_params(members: [
        { user_id: @helper.id, role: "collaborator" }, { user_id: @member.id, role: "invitee" },
      ]) }, as: :json
    end
    token = response.parsed_body["token"]
    assert_equal ["schedule_poll.collaborator"], @helper.notifications.pluck(:kind)
    assert_equal ["schedule_poll.invitee"], @member.notifications.pluck(:kind)
    sign_out @admin

    sign_in @helper
    patch "/api/schedule_polls/#{token}", params: { poll: { title: "Workshop night" } }, as: :json
    assert_response :success
    assert_equal "Workshop night", response.parsed_body["title"]
    delete "/api/schedule_polls/#{token}", as: :json
    assert_response :forbidden
    sign_out @helper

    sign_in @member
    patch "/api/schedule_polls/#{token}", params: { poll: { title: "Nope" } }, as: :json
    assert_response :forbidden
    sign_out @member

    sign_in @admin
    delete "/api/schedule_polls/#{token}", as: :json
    assert_response :no_content
  end

  test "anyone can vote once per network, picks must fit, and organizers hear about it" do
    poll = create_poll(members: [{ user_id: @helper.id, role: "collaborator" }])
    Notification.delete_all

    # 8:30 PM runs into the 9 PM meeting; 10 AM is clear
    put "/api/schedule_polls/#{poll.token}/ballot", params: { choices: [at(0, 20, 30)] }, as: :json
    assert_response :unprocessable_entity
    assert_match "overlaps", response.parsed_body["error"]

    put "/api/schedule_polls/#{poll.token}/ballot", params: { choices: [at(0, 10), at(1, 14), at(2, 19)], voter_name: "Sam" }, as: :json
    assert_response :success
    assert_equal [at(0, 10), at(1, 14), at(2, 19)], response.parsed_body.dig("my_ballot", "choices")
    assert_equal 3, response.parsed_body["results"].first["points"]
    assert_equal ["Sam voted in “Workshop”"] * 2, Notification.order(:id).pluck(:title)

    # Same browser updates its ballot
    put "/api/schedule_polls/#{poll.token}/ballot", params: { choices: [at(1, 14), at(0, 10)] }, as: :json
    assert_response :success
    assert_equal 1, poll.ballots.count

    # Another browser on the same network can't add a second anonymous ballot
    open_session do |other|
      other.put "/api/schedule_polls/#{poll.token}/ballot", params: { choices: [at(0, 10)] }, as: :json
      assert_equal 422, other.response.status
      assert_match "network", other.response.parsed_body["error"]
    end

    # ...but a signed-in member on another browser can
    first = nil
    open_session do |other|
      other.sign_in @member
      other.put "/api/schedule_polls/#{poll.token}/ballot", params: { choices: [at(0, 10)] }, as: :json
      assert_equal 200, other.response.status
      first = other.response.parsed_body["results"].first
    end
    assert_equal 2, poll.ballots.count
    assert_equal [at(0, 10), 2 + 3], [first["start"], first["points"]]
  end

  test "results stay hidden until the poll closes when the poll says so" do
    poll = create_poll(results_visibility: "after_close")
    put "/api/schedule_polls/#{poll.token}/ballot", params: { choices: [at(0, 10)] }, as: :json
    assert_nil response.parsed_body["results"]
    assert_nil response.parsed_body["voters"]

    sign_in @admin
    get "/api/schedule_polls/#{poll.token}", as: :json
    assert_equal 1, response.parsed_body["results"].size
    assert_equal 1, response.parsed_body["voters"].size
    post "/api/schedule_polls/#{poll.token}/close", as: :json
    sign_out @admin

    get "/api/schedule_polls/#{poll.token}", as: :json
    assert response.parsed_body["closed"]
    assert_equal 1, response.parsed_body["results"].size
    put "/api/schedule_polls/#{poll.token}/ballot", params: { choices: [at(1, 10)] }, as: :json
    assert_response :unprocessable_entity
  end

  test "the tagged email links to the poll" do
    poll = create_poll
    member = poll.members.create!(user: @member, role: "invitee")
    mail = SchedulePollMailer.with(member: member).tagged
    assert_equal ["member@example.com"], mail.to
    assert_includes mail.text_part.body.to_s, "/schedule_polls/#{poll.token}"
  end
end
