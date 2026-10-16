require "test_helper"

class Api::EventsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  include ActionMailer::TestHelper

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "nobody@example.com"
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @outsider = User.create!(email: "out@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @member, role: "member")
    Notification.delete_all
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def create_event(title = "Fall Workshop")
    sign_in @leader
    post "/api/groups/#{@group.slug}/events", params: { event: { title: title } }, as: :json
    assert_response :created
    Event.find_by!(token: response.parsed_body["token"])
  end

  def publish(event)
    sign_in @leader
    patch "/api/events/#{event.token}", params: { event: { status: "published" } }, as: :json
    assert_response :success
  end

  test "group admins create events, which need a title; members can't" do
    sign_in @member
    post "/api/groups/#{@group.slug}/events", params: { event: { title: "Mine" } }, as: :json
    assert_response :forbidden

    sign_in @leader
    post "/api/groups/#{@group.slug}/events", params: { event: { title: "" } }, as: :json
    assert_response :unprocessable_entity

    event = create_event
    assert_equal @group, event.group
    assert_equal "draft", event.status
    assert_equal %w[heading notes agenda], event.blocks.map { |b| b["type"] }
  end

  test "drafts are private; published events are public to anyone with the link" do
    event = create_event
    sign_out @leader
    get "/api/events/#{event.token}", as: :json
    assert_response :not_found
    sign_in @member
    get "/api/events/#{event.token}", as: :json
    assert_response :not_found

    publish(event)
    sign_out @leader
    get "/api/events/#{event.token}", as: :json
    assert_response :success
    assert_not response.parsed_body["can_edit"]
    assert_nil response.parsed_body["rsvps"]
    get "/events/#{event.token}"
    assert_response :success
    assert_equal "noindex, nofollow", response.headers["X-Robots-Tag"]
  end

  test "the editor saves layout, details and blocks, cleaning up what it's sent" do
    event = create_event
    blocks = [
      { id: "h1", type: "heading", region: "main", span: 8, text: "Welcome", level: 1 },
      { id: "a1", type: "agenda", region: "side", view: "grid", activities: [
        { id: "x", title: "Coffee", description: "Bring a mug" }, { id: "y", title: "" }, { id: "z", title: "Speaker" },
      ] },
      { id: "p1", type: "photo", photos: [{ url: "javascript:alert(1)" }, { url: "/rails/active_storage/blobs/proxy/abc/pic.png" }] },
      { id: "bad", type: "iframe" },
    ]
    patch "/api/events/#{event.token}", params: { event: {
      title: "Fall Workshop", layout: "side_main", starts_at: "2026-11-01T18:00", ends_at: "2026-11-01T20:00",
      short_description: "x" * 280, blocks: blocks.to_json,
    } }
    assert_response :success
    body = response.parsed_body
    assert_equal "side_main", body["layout"]
    assert_equal "2026-11-01T18:00", body["starts_at"]
    assert_equal %w[heading agenda photo], body["blocks"].map { |b| b["type"] }
    agenda = body["blocks"][1]
    assert_equal [["Coffee", 1], ["Speaker", 2]], agenda["activities"].map { |a| [a["title"], a["queue_number"]] }
    assert_equal 8, body["blocks"][0]["span"]
    assert_equal ["/rails/active_storage/blobs/proxy/abc/pic.png"], body["blocks"][2]["photos"].map { |p| p["url"] }

    patch "/api/events/#{event.token}", params: { event: { short_description: "x" * 281 } }, as: :json
    assert_response :unprocessable_entity
    patch "/api/events/#{event.token}", params: { event: { starts_at: "2026-11-01T18:00", ends_at: "2026-11-01T17:00" } }, as: :json
    assert_response :unprocessable_entity
  end

  test "group admins add members of the group as collaborators, who can then edit" do
    event = create_event
    get "/api/events/#{event.token}/people", params: { q: "mo" }, as: :json
    assert_equal ["Mo"], response.parsed_body.map { |p| p["name"] }
    assert_equal "member@example.com", response.parsed_body.first["email"]

    post "/api/events/#{event.token}/collaborators", params: { user_id: @outsider.id }, as: :json
    assert_response :unprocessable_entity
    post "/api/events/#{event.token}/collaborators", params: { user_id: @member.id }, as: :json
    assert_response :success
    assert_equal ["Mo"], response.parsed_body["collaborators"].map { |p| p["name"] }
    assert_equal ["You can edit “Fall Workshop” now"], @member.notifications.pluck(:title)

    sign_in @member
    patch "/api/events/#{event.token}", params: { event: { title: "Fall Workshop!" } }, as: :json
    assert_response :success
    # ...but only group admins add collaborators or delete the event
    post "/api/events/#{event.token}/collaborators", params: { user_id: @leader.id }, as: :json
    assert_response :forbidden
    delete "/api/events/#{event.token}", as: :json
    assert_response :forbidden
  end

  test "RSVPs: accounts as themselves, guests with an email; update notes reach everyone following" do
    event = create_event
    put "/api/events/#{event.token}/rsvp", params: { status: "going" }, as: :json
    assert_response :unprocessable_entity, "no RSVPs before it's published"
    publish(event)

    sign_in @member
    put "/api/events/#{event.token}/rsvp", params: { status: "maybe" }, as: :json
    assert_response :success
    assert_equal "maybe", response.parsed_body["my_rsvp"]["status"]

    sign_out @member
    put "/api/events/#{event.token}/rsvp", params: { status: "going", name: "Guest" }, as: :json
    assert_response :unprocessable_entity
    put "/api/events/#{event.token}/rsvp", params: { status: "going", name: "Guest", email: "Guest@Example.com" }, as: :json
    assert_response :success
    assert_equal "guest@example.com", response.parsed_body["my_rsvp"]["email"]
    assert_equal 1, response.parsed_body["counts"]["going"]

    sign_in @leader
    blocks = event.reload.blocks + [{ id: "n1", type: "notes", update: true, markdown: "# Parking moved\nUse the back lot." }]
    assert_emails 2 do
      patch "/api/events/#{event.token}", params: { event: { blocks: blocks } }, as: :json
      perform_enqueued_jobs
    end
    assert_response :success
    assert_equal ["Parking moved"], response.parsed_body["sent_updates"].map { |u| u["title"] }
    assert_equal ["Fall Workshop has an update for you!"], @member.notifications.pluck(:title)
    assert_equal "Fall Workshop has an update for you!", ActionMailer::Base.deliveries.last.subject

    # Saving again without changing the note sends nothing
    assert_no_emails do
      patch "/api/events/#{event.token}", params: { event: { blocks: blocks, title: "Fall Workshop" } }, as: :json
      perform_enqueued_jobs
    end
    assert_empty response.parsed_body["sent_updates"]

    # The email's stop link stops them
    guest = event.rsvps.find_by!(email: "guest@example.com")
    get "/events/#{event.token}/unsubscribe", params: { t: guest.token }
    assert_equal "not_going", guest.reload.status
  end

  test "voting in the event's poll follows the event" do
    event = create_event
    publish(event)
    day = Time.current.in_time_zone("America/Phoenix").to_date + 2
    post "/api/schedule_polls", params: { poll: { title: "When?", event_token: event.token, starts_on: day.iso8601, ends_on: (day + 2).iso8601,
                                                 duration_minutes: 60, choices_count: 1 } }, as: :json
    assert_response :created
    poll = SchedulePoll.find_by!(token: response.parsed_body["token"])
    assert_equal event, poll.event
    assert_equal event.token, response.parsed_body["event"]["token"]

    sign_in @member
    post "/api/schedule_polls", params: { poll: { title: "Nope", starts_on: day.iso8601, ends_on: day.iso8601 } }, as: :json
    assert_response :forbidden
    put "/api/schedule_polls/#{poll.token}/ballot", params: { choices: ["#{day.iso8601}T10:00"] }, as: :json
    assert_response :success
    assert_equal "following", event.rsvps.find_by!(user: @member).status

    get "/api/events/#{event.token}", as: :json
    assert_equal ["When?"], response.parsed_body["polls"].map { |p| p["title"] }
  end
end
