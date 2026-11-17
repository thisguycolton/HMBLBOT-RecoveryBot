require "test_helper"

class Api::GroupServiceAndTreasuryTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @leader = User.create!(email: "leader@example.com", name: "Lee", password: "password123", confirmed: true)
    @keeper = User.create!(email: "keeper@example.com", name: "Kay", password: "password123", confirmed: true)
    @member = User.create!(email: "member@example.com", name: "Mo", password: "password123", confirmed: true)
    @other = User.create!(email: "other@example.com", name: "Oz", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    @group.memberships.create!(user: @leader, role: "admin")
    @group.memberships.create!(user: @keeper, role: "member", can_keep_records: true)
    @group.memberships.create!(user: @member, role: "member")
    Group.create!(title: "Night Owls", time_zone: "America/Phoenix").memberships.create!(user: @other, role: "member")
    @today = @group.zone.today
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def body = response.parsed_body
  def positions(*rest) = ["/api/groups/#{@group.slug}/service_positions", *rest].join("/")
  def reports(*rest) = ["/api/groups/#{@group.slug}/treasurer_reports", *rest].join("/")

  test "an admin sees roles given by hand before offices, and turns one into an office" do
    sign_in @keeper
    get positions, as: :json
    assert_nil body["hand_grants"], "only admins see them"

    sign_in @leader
    get positions, as: :json
    assert_equal [["Kay", "can_keep_records"]], body["hand_grants"].map { |g| g.values_at("name", "grants") }
    assert_equal ["Lee"], body["admins"]

    grant = body["hand_grants"].first
    post positions, params: { service_position: { title: "Secretary", grants: "can_keep_records" }, from_membership_id: grant["membership_id"] }, as: :json
    assert_response :created
    assert_equal "Kay", body["current"]["name"]
    keeper = @group.membership_for(@keeper)
    assert_equal [true, ["can_keep_records"]], [keeper.can_keep_records, keeper.office_roles]
    get positions, as: :json
    assert_empty body["hand_grants"]
  end

  test "roles aren't given in Members any more, and an office's role can't be taken away there" do
    sign_in @leader
    member = @group.membership_for(@member)
    patch "/api/groups/#{@group.slug}/memberships/#{member.id}", params: { can_keep_records: true }, as: :json
    assert_response :unprocessable_entity
    assert_match "Offices", body["error"]

    office = @group.service_positions.create!(title: "Treasurer", grants: "can_keep_treasury")
    post positions(office.id, "terms"), params: { term: { name: "Mo", user_id: @member.id, starts_on: @today.to_s } }, as: :json
    patch "/api/groups/#{@group.slug}/memberships/#{member.id}", params: { can_keep_treasury: false }, as: :json
    assert_response :unprocessable_entity
    assert member.reload.can_keep_treasury

    # A role given by hand before offices can still be taken back
    keeper = @group.membership_for(@keeper)
    patch "/api/groups/#{@group.slug}/memberships/#{keeper.id}", params: { can_keep_records: false }, as: :json
    assert_response :no_content
    assert_not keeper.reload.can_keep_records
  end

  test "an office's role ends with the term, the first time the group is opened that day" do
    office = @group.service_positions.create!(title: "Treasurer", grants: "can_keep_treasury")
    sign_in @leader
    post positions(office.id, "terms"), params: { term: { name: "Mo", user_id: @member.id, starts_on: (@today - 30).to_s, ends_on: (@today + 1).to_s } }, as: :json
    assert @group.membership_for(@member).can_keep_treasury

    office.terms.first.update!(ends_on: @today - 1) # time passes
    @group.update_columns(office_roles_synced_on: @today - 1)
    get positions, as: :json
    assert_not @group.membership_for(@member).can_keep_treasury
    assert_equal @today, @group.reload.office_roles_synced_on
    assert @group.membership_for(@keeper).can_keep_records, "a role given by hand stays"
  end

  test "retiring an office takes its role from the holder" do
    office = @group.service_positions.create!(title: "Secretary", grants: "can_keep_records")
    sign_in @leader
    post positions(office.id, "terms"), params: { term: { name: "Mo", user_id: @member.id, starts_on: @today.to_s } }, as: :json
    assert @group.membership_for(@member).can_keep_records
    patch positions(office.id), params: { service_position: { archived: true } }, as: :json
    assert_not @group.membership_for(@member).can_keep_records
  end

  test "an office gives its holder its role, and the role passes to the next person" do
    secretary = @group.service_positions.create!(title: "Secretary")
    sign_in @keeper
    patch positions(secretary.id), params: { service_position: { grants: "can_keep_records" } }, as: :json
    assert_nil secretary.reload.grants, "only admins choose which role an office gives"

    sign_in @leader
    patch positions(secretary.id), params: { service_position: { grants: "can_keep_records" } }, as: :json
    assert_equal "can_keep_records", secretary.reload.grants
    post positions(secretary.id, "terms"), params: { term: { name: "Mo", user_id: @member.id, starts_on: (@today - 30).to_s } }, as: :json
    assert @group.membership_for(@member).can_keep_records

    post positions(secretary.id, "terms"), params: { term: { name: "Oz", starts_on: @today.to_s } }, as: :json
    assert_not @group.membership_for(@member).can_keep_records, "the one before loses it"
  end

  test "a host coordinator office named for a time starts with the meetings at that time; admins change its slots" do
    nine = @group.meetings.create!(name: "Morning", recurrence: "weekly", day_of_week: 1, start_minute: 540)
    night = @group.meetings.create!(name: "Night", recurrence: "weekly", day_of_week: 1, start_minute: 1260)
    sign_in @leader
    post positions, params: { service_position: { title: "9AM Host Coordinator", grants: "can_schedule_hosts" } }, as: :json
    assert_equal [nine.id], body["host_meeting_ids"]
    office = @group.service_positions.find(body["id"])
    post positions(office.id, "terms"), params: { term: { name: "Mo", user_id: @member.id, starts_on: @today.to_s } }, as: :json
    m = @group.membership_for(@member)
    assert_equal [true, true, [nine.id]], [m.can_schedule_hosts, m.host_slots_only, m.host_meeting_ids]

    patch positions(office.id), params: { service_position: { host_meeting_ids: [nine.id, night.id, 0] } }, as: :json
    assert_equal [nine.id, night.id].sort, m.reload.host_meeting_ids
    patch positions(office.id), params: { service_position: { host_meeting_ids: [""] } }, as: :json
    assert_equal [true, false], [m.reload.can_schedule_hosts, m.host_slots_only], "no slots: the whole group"

    patch "/api/groups/#{@group.slug}/memberships/#{m.id}", params: { host_slots_only: true }, as: :json
    assert_response :unprocessable_entity, "an office's slots are changed on the office"

    sign_in @keeper
    patch positions(office.id), params: { service_position: { host_meeting_ids: [nine.id] } }, as: :json
    assert_equal [], office.reload.host_meeting_ids, "only admins choose an office's slots"
  end

  test "offices with the same agenda heading share a section, with their holders' names filled in" do
    [["9AM Host Coordinator", "9 am: {name}", "AJ"], ["12PM Host Coordinator", "12 pm: {name}", nil]].each do |title, line, name|
      p = @group.service_positions.create!(title: title, on_agenda: true, agenda_heading: "Host Coordinators", agenda_lines: line)
      p.terms.create!(name: name, starts_on: @today - 1) if name
    end
    secretary = @group.service_positions.create!(title: "Secretary", on_agenda: true, agenda_lines: "{last_month} minutes\n{month} agenda")
    secretary.terms.create!(name: "Jillian", starts_on: @today - 1)
    meeting = @group.business_meetings.create!(held_on: Date.new(2026, 11, 15))
    assert_equal [["Host Coordinators", ["9 am: AJ", "12 pm: (open)"]], ["Secretary", ["Oct minutes", "Nov agenda"]]],
                 meeting.officer_sections.map { |s| [s[:title], s[:lines]] }
  end

  test "members read service positions; record keepers change them" do
    get positions, as: :json
    assert_response :unauthorized
    sign_in @other
    get positions, as: :json
    assert_response :not_found

    sign_in @member
    post positions, params: { service_position: { title: "Treasurer" } }, as: :json
    assert_response :forbidden
    get positions, as: :json
    assert_equal [false, []], [body["can_edit"], body["members"]]

    sign_in @keeper
    post positions, params: { service_position: { title: " Treasurer ", description: "Counts the basket", term_months: 12, sobriety_months: 12 } }, as: :json
    assert_response :created
    id = body["id"]
    assert_equal ["Treasurer", "vacant"], body.values_at("title", "rotation")
    post positions, params: { service_position: { title: "" } }, as: :json
    assert_response :unprocessable_entity
    patch positions(id), params: { service_position: { term_months: 6 } }, as: :json
    assert_equal 6, body["term_months"]
    get positions, as: :json
    assert_equal [true, ["Kay", "Lee", "Mo"]], [body["can_edit"], body["members"].map { |m| m["name"] }]
  end

  test "putting someone in a position ends the term before it" do
    position = @group.service_positions.create!(title: "Chair", term_months: 6)
    sign_in @keeper
    post positions(position.id, "terms"), params: { term: { name: "Mo M.", user_id: @member.id, starts_on: (@today - 100).to_s } }, as: :json
    assert_response :created
    assert_equal "Mo M.", body.dig("current", "name")

    post positions(position.id, "terms"), params: { term: { name: "Kay K.", user_id: @other.id, starts_on: @today.to_s } }, as: :json
    assert_response :created
    assert_equal ["Kay K.", false], [body.dig("current", "name"), body.dig("current", "linked")], "someone outside the group isn't linked"
    assert_equal [(@today - 1).iso8601], body["history"].map { |t| t["ends_on"] }
    assert_nil body["rotation"]

    term_id = body["current"]["id"]
    patch positions(position.id, "terms", term_id), params: { term: { ends_on: (@today + 5).to_s } }, as: :json
    assert_equal "due", body["rotation"]
    post positions(position.id, "terms"), params: { term: { name: "", starts_on: @today.to_s } }, as: :json
    assert_response :unprocessable_entity
    delete positions(position.id, "terms", term_id), as: :json
    assert_equal ["Mo M."], body["history"].map { |t| t["name"] }

    sign_in @member
    post positions(position.id, "terms"), params: { term: { name: "Me", starts_on: @today.to_s } }, as: :json
    assert_response :forbidden
  end

  test "opening the list sends due reminders" do
    position = @group.service_positions.create!(title: "Secretary")
    position.terms.create!(name: "Mo M.", user: @member, starts_on: @today - 300, ends_on: @today + 12)
    sign_in @member
    assert_difference -> { Notification.count } => 3 do # Lee and Kay, and Mo whose term it is
      get positions, as: :json
    end
    assert_equal "due", body["positions"].first["rotation"]
    assert_no_difference -> { Notification.count } do
      get positions, as: :json
    end
  end

  test "the treasurer office's holder writes and posts reports, and sees drafts" do
    treasurer = User.create!(email: "treasurer@example.com", name: "Tess", password: "password123", confirmed: true)
    membership = @group.memberships.create!(user: treasurer, role: "member")
    sign_in treasurer
    post reports, params: { treasurer_report: { period_on: "2026-08-01" } }, as: :json
    assert_response :forbidden

    sign_in @leader
    office = @group.service_positions.create!(title: "Treasurer", grants: "can_keep_treasury")
    post positions(office.id, "terms"), params: { term: { name: "Tess", user_id: treasurer.id, starts_on: @today.to_s } }, as: :json
    assert membership.reload.can_keep_treasury

    sign_in treasurer
    post reports, params: { treasurer_report: { period_on: "2026-08-01" } }, as: :json
    assert_response :created
    get reports, as: :json
    assert_equal [1, true, false], [body["reports"].size, body["can_edit"], body["can_delete"]]
    patch reports(body["reports"].first["id"]), params: { treasurer_report: { status: "posted" } }, as: :json
    assert_response :success
    post positions, params: { service_position: { title: "GSR" } }, as: :json
    assert_response :forbidden, "being treasurer isn't being a record keeper"
  end

  test "members read posted reports; record keepers write them; group admins delete" do
    sign_in @keeper
    post reports, params: { treasurer_report: { period_on: "2026-09-20", opening_cents: 30_000, reserve_cents: 30_000,
      lines: [{ kind: "income", label: "Seventh Tradition", cents: 14_200 }, { kind: "expense", label: "Rent", cents: 6_000 }],
      splits: [{ label: "District", percent: 30 }, { label: "Area", percent: 10 }], notes: "Good month" } }, as: :json
    assert_response :created
    id = body["id"]
    assert_equal ["2026-09-01", "draft", 8_200], [body["period_on"], body["status"], body.dig("summary", "above_reserve_cents")]
    assert_equal [["District", 2_460], ["Area", 820]], body.dig("summary", "shares").map { |s| [s["label"], s["cents"]] }

    post reports, params: { treasurer_report: { period_on: "2026-09-02" } }, as: :json
    assert_response :unprocessable_entity
    assert_match "already has a report", body["error"]

    sign_in @member
    get reports, as: :json
    assert_equal [], body["reports"], "it's still a draft"
    patch reports(id), params: { treasurer_report: { status: "posted" } }, as: :json
    assert_response :forbidden

    sign_in @keeper
    patch reports(id), params: { treasurer_report: { status: "posted" } }, as: :json
    assert_response :success
    sign_in @member
    get reports, as: :json
    assert_equal [id], body["reports"].map { |r| r["id"] }
    assert_equal [false, false], [body["can_edit"], body["can_delete"]]

    sign_in @keeper
    delete reports(id), as: :json
    assert_response :forbidden
    sign_in @leader
    delete reports(id), as: :json
    assert_response :no_content

    sign_in @other
    get reports, as: :json
    assert_response :not_found
  end
end
