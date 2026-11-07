require "test_helper"

class Api::PollsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  include ActionCable::TestHelper

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    @keeper = User.create!(email: "keeper@example.com", name: "Kay K.", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo M.", password: "password123", confirmed: true)
    @outsider = User.create!(email: "out@example.com", name: "Oz O.", password: "password123", confirmed: true)
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
  end

  def make_poll(**overrides)
    sign_in @keeper
    post "/api/polls", params: { poll: {
      question: "Which topic next week?", group_id: @group.id, audience: "anyone",
      options: [{ label: "Acceptance" }, { label: "Gratitude" }, { label: "Step 3" }],
    }.merge(overrides) }, as: :json
    assert_response :created, response.body
    sign_out @keeper
    Poll.find_by!(token: response.parsed_body["token"])
  end

  def option(poll, label) = poll.options.find_by!(label: label)

  test "group record keepers make polls with a short code; plain members and outsiders can't" do
    poll = make_poll
    assert_match(/\A[a-z2-9]{6}\z/, poll.token)
    assert_equal %w[Acceptance Gratitude Step\ 3], poll.options.map(&:label)
    assert_equal "/p/#{poll.token}", poll.short_path

    sign_in @member
    post "/api/polls", params: { poll: { question: "Q", group_id: @group.id, options: [{ label: "a" }, { label: "b" }] } }, as: :json
    assert_response :forbidden
    post "/api/polls", params: { poll: { question: "Q", options: [{ label: "a" }, { label: "b" }] } }, as: :json
    assert_response :forbidden
  end

  test "a poll needs two different answers" do
    sign_in @keeper
    post "/api/polls", params: { poll: { question: "Q", group_id: @group.id, options: [{ label: "a" }] } }, as: :json
    assert_response :unprocessable_entity
    post "/api/polls", params: { poll: { question: "Q", group_id: @group.id, options: [{ label: "a" }, { label: "A" }] } }, as: :json
    assert_response :unprocessable_entity
  end

  test "guests vote by cookie with a name, one per network, and can change their vote" do
    poll = make_poll
    assert_broadcasts(PollChannel.broadcasting_for(poll), 1) do
      put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Gratitude").id], voter_name: "Sam S." }, as: :json
    end
    assert_response :success
    body = response.parsed_body
    assert_equal 1, body["ballots_count"]
    assert_equal 1, body["options"].find { |o| o["label"] == "Gratitude" }["count"]
    assert_nil body["options"].first["voters"], "guests don't see who voted"

    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Acceptance").id] }, as: :json
    assert_response :success
    assert_equal 1, poll.ballots.count
    assert_equal [option(poll, "Acceptance").id], poll.ballots.first.option_ids

    # Another browser on the same network
    cookies.delete("hb_voter")
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Step 3").id] }, as: :json
    assert_response :unprocessable_entity
    assert_match(/same network|this network/, response.parsed_body["error"])
  end

  test "the people running it see who voted for what; others only when the poll says so" do
    poll = make_poll(audience: "signed_in")
    sign_in @member
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Step 3").id] }, as: :json
    assert_response :success
    assert_nil response.parsed_body["options"].last["voters"]
    sign_out @member

    sign_in @keeper
    get "/api/polls/#{poll.token}", as: :json
    voters = response.parsed_body["options"].find { |o| o["label"] == "Step 3" }["voters"]
    assert_equal ["Mo M."], voters.map { |v| v["name"] }
    sign_out @keeper

    poll.update!(voters_visibility: "everyone")
    sign_in @outsider
    get "/api/polls/#{poll.token}", as: :json
    assert_equal ["Mo M."], response.parsed_body["options"].find { |o| o["label"] == "Step 3" }["voters"].map { |v| v["name"] }
  end

  test "who can vote: signed in, members only" do
    poll = make_poll(audience: "signed_in")
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Gratitude").id] }, as: :json
    assert_response :unprocessable_entity
    assert_match(/Sign in/, response.parsed_body["error"])

    poll.update!(audience: "members")
    sign_in @outsider
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Gratitude").id] }, as: :json
    assert_response :unprocessable_entity
    sign_out @outsider
    sign_in @member
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Gratitude").id] }, as: :json
    assert_response :success
  end

  test "pick one, or up to N" do
    poll = make_poll
    ids = poll.options.map(&:id)
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: ids.first(2) }, as: :json
    assert_response :unprocessable_entity
    poll.update!(max_choices: 2)
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: ids.first(2) }, as: :json
    assert_response :success
  end

  test "results can wait until you vote or it closes, and closing stops voting" do
    poll = make_poll(results_visibility: "after_vote")
    get "/api/polls/#{poll.token}", as: :json
    assert_not response.parsed_body["show_results"]
    assert_nil response.parsed_body["options"].first["count"]

    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Gratitude").id] }, as: :json
    assert response.parsed_body["show_results"]

    sign_in @keeper
    post "/api/polls/#{poll.token}/close", as: :json
    assert response.parsed_body["closed"]
    sign_out @keeper
    cookies.delete("hb_voter")
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Gratitude").id] }, as: :json
    assert_response :unprocessable_entity
    assert_match(/closed/, response.parsed_body["error"])
  end

  test "a guest vote becomes the account's on signing in" do
    poll = make_poll
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Gratitude").id], voter_name: "Mo" }, as: :json
    sign_in @member
    get "/api/polls/#{poll.token}", as: :json
    assert response.parsed_body["my_ballot"]
    assert_equal @member.id, poll.ballots.first.reload.user_id
  end

  test "removing an answer takes its votes with it; only managers edit" do
    poll = make_poll
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [option(poll, "Step 3").id] }, as: :json
    sign_in @member
    patch "/api/polls/#{poll.token}", params: { poll: { question: "Hacked" } }, as: :json
    assert_response :forbidden
    sign_out @member

    sign_in @keeper
    keep = poll.options.where.not(label: "Step 3").map { |o| { id: o.id, label: o.label } }
    patch "/api/polls/#{poll.token}", params: { poll: { options: keep + [{ label: "Service" }] } }, as: :json
    assert_response :success, response.body
    assert_equal %w[Acceptance Gratitude Service], poll.reload.options.map(&:label)
    assert_equal 0, poll.ballots.count
  end

  test "the short link and poll page are public; the list needs an account" do
    poll = make_poll
    get "/p/#{poll.token}"
    assert_response :success
    assert_includes response.body, "polls-root"
    get "/polls"
    assert_redirected_to "/users/sign_in"
  end
end

class Api::PollSubjectsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    @keeper = User.create!(email: "keeper@example.com", name: "Kay K.", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo M.", password: "password123", confirmed: true)
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    @motion = @group.motions.create!(title: "Buy new literature", status: "proposed", created_by: @keeper)
    @reading = Reading.create!(title: "Acceptance", user: @member, group: nil, meetingDate: Date.current)
  end

  def attach(type, id, **extra)
    post "/api/polls", params: { poll: { question: "Q?", subject_type: type, subject_id: id, audience: "members",
                                         options: [{ label: "Yes" }, { label: "No" }, { label: "Abstain" }] }.merge(extra) }, as: :json
  end

  test "record keepers take a poll on a motion; it shows with the motion and its counts can go into the record" do
    sign_in @member
    attach("Motion", @motion.id)
    assert_response :forbidden
    sign_out @member

    sign_in @keeper
    get "/api/polls/subject", params: { type: "Motion", id: @motion.id }
    assert_equal "Buy new literature", response.parsed_body["title"]
    attach("Motion", @motion.id)
    assert_response :created, response.body
    poll = Poll.find_by!(token: response.parsed_body["token"])
    assert_equal @group, poll.group
    assert_equal @motion, poll.subject

    get "/api/groups/#{@group.slug}/motions", as: :json
    assert_equal [poll.token], response.parsed_body["motions"].find { |m| m["id"] == @motion.id }["polls"]
    sign_out @keeper

    sign_in @member
    put "/api/polls/#{poll.token}/ballot", params: { option_ids: [poll.options.find_by!(label: "Yes").id] }, as: :json
    assert_response :success
    assert_equal({ "votes_for" => 1, "votes_against" => 0, "abstentions" => 0 }, response.parsed_body.dig("subject", "counts"))
  end

  test "a reading's owner adds a poll to it, even without a group; others can't" do
    sign_in @keeper
    attach("Reading", @reading.id, audience: "anyone")
    assert_response :forbidden
    sign_out @keeper

    sign_in @member
    attach("Reading", @reading.id, audience: "anyone")
    assert_response :created, response.body
    poll = Poll.find_by!(token: response.parsed_body["token"])
    assert_equal [poll], @reading.polls.to_a
    assert poll.manager?(@member)

    get "/readings/#{@reading.id}"
    assert_includes response.body, poll.token
  end
end
