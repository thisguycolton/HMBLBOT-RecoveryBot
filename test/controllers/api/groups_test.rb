require "test_helper"

class Api::GroupsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "admin@example.com"
    @admin = User.create!(email: "admin@example.com", name: "Colton", password: "password123", confirmed: true, admin: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @stranger = User.create!(email: "stranger@example.com", name: "Sam", password: "password123", confirmed: true)
    Notification.delete_all
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def create_group(title = "Sunrise Crew")
    sign_in @admin
    post "/api/groups", params: { group: { title: title, description: "Mornings", time_zone: "America/Phoenix" } }, as: :json
    assert_response :created
    Group.find_by!(slug: response.parsed_body["slug"])
  end

  test "groups are admin-only for now: others can look at a group but not make one" do
    sign_in @stranger
    get "/groups"
    assert_redirected_to root_path
    post "/api/groups", params: { group: { title: "Mine" } }, as: :json
    assert_response :forbidden
    get "/api/groups/#{groups(:one).slug}", as: :json
    assert_response :success
    assert_nil response.parsed_body["members"]

    group = create_group
    assert group.admin?(@admin)
    get "/groups/#{group.slug}"
    assert_response :success
    assert_equal "noindex, nofollow", response.headers["X-Robots-Tag"]
  end

  test "the invite link puts people in the group, even if they sign up first" do
    group = create_group
    sign_out @admin

    get "/groups/join/#{group.join_token}"
    assert_redirected_to new_user_registration_path
    post user_session_path, params: { user: { email: @stranger.email, password: "password123" } }
    assert_redirected_to "/groups/#{group.slug}"
    assert group.member?(@stranger)

    # Once in a group, they see it even though Groups isn't open to them yet
    get "/api/groups/#{group.slug}", as: :json
    assert_response :success
    body = response.parsed_body
    assert body["is_member"]
    assert_not body["can_manage"]
    assert_nil body["invite_url"]
    assert_equal %w[Colton Sam], body["members"].map { |m| m["name"] }
    assert_nil body["members"].first["email"], "only group admins see emails"

    get "/groups/join/nope"
    assert_redirected_to root_path
  end

  test "join requests go to the group's admins, who approve them" do
    group = create_group
    ENV["ADMIN_EMAILS"] = "admin@example.com,member@example.com"
    @member.update!(admin: true) # Groups is open to site admins; stands in for "everyone"
    sign_in @member
    post "/api/groups/#{group.slug}/join", as: :json
    assert_response :success
    assert_equal "requested", response.parsed_body["membership_status"]
    assert_equal ["Mo asked to join Sunrise Crew"], @admin.notifications.pluck(:title)
    assert_not group.member?(@member)

    sign_in @admin
    membership = group.memberships.find_by!(user: @member)
    patch "/api/groups/#{group.slug}/memberships/#{membership.id}", params: { status: "active" }, as: :json
    assert_response :no_content
    assert group.member?(@member)
    assert_includes @member.notifications.pluck(:title), "You're in Sunrise Crew"
  end

  test "members can't run the group; the last admin can't step down" do
    group = create_group
    group.memberships.create!(user: @member)
    sign_in @member
    patch "/api/groups/#{group.slug}", params: { group: { title: "Hijacked" } }, as: :json
    assert_response :forbidden
    post "/api/groups/#{group.slug}/meetings", params: { meeting: { name: "x", day_of_week: 1, start_minute: 60 } }, as: :json
    assert_response :forbidden
    get "/api/groups/#{group.slug}/court_verifications", as: :json
    assert_response :forbidden

    sign_in @admin
    admin_membership = group.memberships.find_by!(user: @admin)
    patch "/api/groups/#{group.slug}/memberships/#{admin_membership.id}", params: { role: "member" }, as: :json
    assert_response :unprocessable_entity
    post "/api/groups/#{group.slug}/memberships", params: { email: "MEMBER@example.com", role: "admin" }, as: :json
    assert_response :created
    assert group.admin?(@member)
  end

  test "meetings: by hand, linked to an OIAA listing, imported, and unlinked" do
    group = create_group
    OiaaFeed.sync!([
      { slug: "x1", name: "Sunrise Zoom", group: "Sunrise Crew", day: [1, 3], time: "07:00", timezone: "America/Phoenix",
        conference_url: "https://zoom.us/j/81234567890" },
      { slug: "x2", name: "Saturday Speaker", group: "Sunrise Crew", day: 6, time: "10:00", timezone: "America/Phoenix" },
    ].to_json)

    get "/api/oiaa/matches", params: { name: "sunrise", day: 1, start_minute: 420, time_zone: "America/Phoenix" }
    match = response.parsed_body["matches"].first
    assert_equal ["x1", 1], [match["slug"], match["day"]]

    post "/api/groups/#{group.slug}/meetings", params: { meeting: { name: "Ignored", notes: "Doors at 6:45" }, oiaa_slug: "x1" }, as: :json
    assert_response :created
    assert_equal 2, response.parsed_body["created"], "one per day OIAA lists"
    linked = group.meetings.find_by!(oiaa_slug: "x1", day_of_week: 1)
    assert_equal ["Sunrise Zoom", 1, 420, "Doors at 6:45"], [linked.name, linked.day_of_week, linked.start_minute, linked.notes]

    patch "/api/groups/#{group.slug}/meetings/#{linked.id}", params: { meeting: { name: "Renamed", notes: "New notes" } }, as: :json
    assert_equal ["Sunrise Zoom", "New notes"], [linked.reload.name, linked.notes], "linked meetings only change local fields"

    post "/api/groups/#{group.slug}/meetings/import", params: { slugs: %w[x1 x2] }, as: :json
    assert_equal 1, response.parsed_body["created"], "x1's days are already there"

    post "/api/groups/#{group.slug}/meetings", params: { meeting: { name: "Step study", start_minute: 1080 }, days: [1, 3, 5] }, as: :json
    assert_equal 3, response.parsed_body["created"]

    post "/api/groups/#{group.slug}/meetings/#{linked.id}/unlink", as: :json
    patch "/api/groups/#{group.slug}/meetings/#{linked.id}", params: { meeting: { name: "Renamed" } }, as: :json
    assert_equal "Renamed", linked.reload.name

    post "/api/groups/#{group.slug}/meetings", params: { meeting: { name: "Workshop", recurrence: "once", starts_at: "2026-11-01T18:00" } }, as: :json
    assert_response :created
    assert_equal Time.find_zone("America/Phoenix").parse("2026-11-01 18:00"), Meeting.last.starts_at
  end

  test "find your group: groups here, and OIAA meetings that could start one" do
    group = create_group("Sunrise Crew")
    OiaaFeed.sync!([{ slug: "x1", name: "Sunrise Zoom", day: [1], time: "07:00", timezone: "America/Phoenix" },
                    { slug: "y1", name: "Sunset Study", group: "Sunset Folks", day: [2], time: "19:00", timezone: "America/Phoenix" }].to_json)
    group.meetings.new.apply_oiaa(OiaaMeeting.find_by!(slug: "x1")).save!

    get "/api/groups/find", params: { q: "sun" }, as: :json
    body = response.parsed_body
    assert_includes body["groups"].map { |g| g["slug"] }, "sunrise-crew"
    assert_equal({ "x1" => "sunrise-crew", "y1" => nil }, body["oiaa"].to_h { |r| [r["slug"], r.dig("group", "slug")] })

    # The same moment typed in Eastern time (Phoenix has no daylight time, so the gap varies)
    gap = (Time.find_zone("America/New_York").now.utc_offset - Time.find_zone("America/Phoenix").now.utc_offset) / 60
    get "/api/groups/find", params: { day: 1, start_minute: 420 + gap, time_zone: "America/New_York" }, as: :json
    assert_includes response.parsed_body["groups"].map { |g| g["slug"] }, "sunrise-crew"
    get "/api/groups/find", params: { day: 2, start_minute: 420, time_zone: "America/Phoenix" }, as: :json
    assert_empty response.parsed_body["groups"]

    post "/api/groups/start", params: { oiaa_slug: "y1" }, as: :json
    assert_response :created
    started = Group.find_by!(slug: response.parsed_body["slug"])
    assert_equal ["Sunset Folks", "pending", 1], [started.title, started.status, started.meetings.count]

    post "/api/groups/start", params: { oiaa_slug: "x1" }, as: :json
    assert_response :unprocessable_entity
  end

  test "literature and readings show to members" do
    group = create_group
    group.memberships.create!(user: @member)
    book = books(:one)
    post "/api/groups/#{group.slug}/books", params: { book_slug: book.slug, note: "Chapter 5 on Thursdays" }, as: :json
    assert_response :created
    Reading.create!(title: "Acceptance", user: @member, group: group, published_at: 1.hour.ago, meetingDate: Date.current, meetingTime: "07:00")
    Reading.create!(title: "Draft", user: @member, group: group)

    sign_in @member
    get "/api/groups/#{group.slug}", as: :json
    body = response.parsed_body
    assert_equal [book.slug], body["books"].map { |b| b.dig("book", "slug") }
    assert_equal ["Acceptance"], body["readings"].map { |r| r["title"] }
  end

  test "a group's court verification form uses its meetings and lands on its page" do
    group = create_group
    meeting = group.meetings.create!(name: "Sunrise", day_of_week: Time.find_zone("America/Phoenix").today.wday, start_minute: 420)
    sign_out @admin

    get "/court_verifications/new", params: { group: group.slug }
    assert_response :success
    assert_includes response.body, "data-group="

    today = Time.find_zone("America/Phoenix").today
    post "/api/court_verifications", params: { group_slug: group.slug, meeting_id: meeting.id, meeting_date: today.iso8601,
                                               court_verification: { respondent_name: "R", respondent_email: "r@example.com", host_name: "H", signer_name: "S", topic: "T" } }, as: :json
    assert_response :created
    verification = CourtVerification.last
    assert_equal [group, meeting], [verification.group, verification.meeting]
    assert_equal today.in_time_zone("America/Phoenix") + 7.hours, verification.meeting_at
    assert_equal "Sunrise Crew", verification.group_label

    sign_in @admin
    get "/api/groups/#{group.slug}/court_verifications", as: :json
    assert_equal ["R"], response.parsed_body["verifications"].map { |v| v["respondent_name"] }
  end

  test "group admins edit the court verification email; members can't" do
    group = create_group
    get "/api/groups/#{group.slug}", as: :json
    assert_equal CourtLetter::DEFAULT_SUBJECT, response.parsed_body.dig("court_email", "subject")

    patch "/api/groups/#{group.slug}", params: { group: { court_email_subject: "{{group}} letter", court_email_body: "{{attendee}} came." } }, as: :json
    assert_response :success
    assert_equal "{{attendee}} came.", response.parsed_body.dig("court_email", "body")

    patch "/api/groups/#{group.slug}", params: { group: { court_email_body: "{{nope}}" } }, as: :json
    assert_response :unprocessable_entity

    group.memberships.create!(user: @member, role: "member", status: "active")
    sign_in @member
    get "/api/groups/#{group.slug}", as: :json
    assert_nil response.parsed_body["court_email"]
    patch "/api/groups/#{group.slug}", params: { group: { court_email_body: "Hacked" } }, as: :json
    assert_response :forbidden
    assert_equal "{{attendee}} came.", group.reload.court_email_body
  end
end
