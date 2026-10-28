require "test_helper"

# A member's 10th step inventories, gratitude lists, streaks and chips (Api::RecoveryController,
# Api::StepInventoriesController, Api::GratitudeListsController), chips a group gives
# (Api::ChipAwardsController, ChipsController), Meeting Maker chips (Api::MeetingJoinsController)
# and a group's chip designs (Api::GroupChipsController)
class Api::RecoveryToolsTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim", sobriety_date: Date.current - 100)
    @lee = User.create!(email: "lee@example.com", password: "password123", confirmed: true, name: "Lee")
    @group = Group.create!(title: "The Acid Test")
    @other = Group.create!(title: "Sunrise Group")
  end

  def day(n = 0) = (Date.current - n).iso8601

  test "a 10th step saves for the day, keeps only the questions, and earns the first triangle chip" do
    sign_in @kim
    put "/api/step_inventories/#{day}", params: { answers: { resentful: { answer: "yes", note: "At work" }, kind: { answer: "maybe" }, bogus: { answer: "yes" } }, notes: "Call Sam" }, as: :json
    assert_response :success
    body = response.parsed_body
    assert_equal ["inventory:1", "triangle"], body["new_chip"].values_at("id", "shape")
    assert_equal({ "resentful" => { "answer" => "yes", "note" => "At work" } }, body.dig("entry", "answers"))
    assert_equal "Call Sam", body.dig("entry", "notes")

    # Saving the same day again changes it, and earns nothing new
    put "/api/step_inventories/#{day}", params: { answers: { afraid: { answer: "no" } }, notes: "" }, as: :json
    assert_nil response.parsed_body["new_chip"]
    assert_equal 1, @kim.step_inventories.count
    assert_equal({ "afraid" => { "answer" => "no", "note" => "" } }, @kim.step_inventories.first.answers)

    # Emptied, it goes
    put "/api/step_inventories/#{day}", params: { answers: {}, notes: "" }, as: :json
    assert_nil response.parsed_body["entry"]
    assert_equal 0, @kim.step_inventories.count
  end

  test "nobody else can read a member's inventories or gratitude lists" do
    @kim.step_inventories.create!(on: Date.current, notes: "private")
    @kim.gratitude_lists.create!(on: Date.current, items: ["my sponsor"])
    sign_in @lee
    get "/api/step_inventories/#{day}"
    assert_nil response.parsed_body["entry"]
    get "/api/gratitude_lists"
    assert_equal [], response.parsed_body["entries"]

    sign_out @lee
    get "/api/gratitude_lists", as: :json
    assert_response :unauthorized
  end

  test "gratitude lists drop blank lines, list newest first, and count toward triangle chips" do
    sign_in @kim
    7.times do |i|
      put "/api/gratitude_lists/#{day(6 - i)}", params: { items: ["Coffee", "  ", "My group"] }, as: :json
    end
    # The 7th list earns two: 7 lists, and 7 days in a row (the newest is shown)
    assert_equal "gratitude-streak:7", response.parsed_body.dig("new_chip", "id")
    assert_equal({ "current" => 7, "best" => 7 }, response.parsed_body["streak"])
    assert_equal ["Coffee", "My group"], @kim.gratitude_lists.find_by(on: Date.current).items

    get "/api/gratitude_lists"
    body = response.parsed_body
    assert_equal day, body["entries"].first["on"]
    assert_equal 7, body["total"]

    get "/api/recovery?today=#{day}"
    body = response.parsed_body
    earned = body["chips"].select { |c| c["kind"].start_with?("gratitude") }
    assert_equal %w[gratitude:1 gratitude:7 gratitude-streak:7], earned.map { |c| c["id"] }
    assert_equal day(6), earned.first["on"]
    assert_equal %w[gratitude:30 gratitude-streak:30], body["upcoming"].select { |c| c["kind"].start_with?("gratitude") }.map { |c| c["id"] }
    assert_equal({ "current" => 7, "best" => 7 }, body.dig("streaks", "gratitude"))
    assert body["today"]["gratitude"]
  end

  test "a day in the future isn't taken" do
    sign_in @kim
    put "/api/gratitude_lists/#{(Date.current + 5).iso8601}", params: { items: ["Tomorrow"] }, as: :json
    assert_response :unprocessable_entity
  end

  test "earned chips are the plain RecoveryBot design, with no group on them" do
    @group.memberships.create!(user: @kim, role: "member")
    @group.update!(chip_design: { "round" => { "top_text" => "Acid Test" } })
    sign_in @kim

    get "/api/recovery"
    body = response.parsed_body
    assert_equal ChipDesign::DEFAULT["round"]["top_text"], body.dig("design", "round", "top_text")
    assert_equal (Date.current - 100).iso8601, body["sobriety_date"]
    round = body["chips"].select { |c| c["shape"] == "round" }
    assert_equal %w[round:24h round:30d round:60d round:90d], round.map { |c| c["id"] }
    assert round.none? { |c| c["design"] || c["group"] }
    assert_equal "round:6m", body["upcoming"].find { |c| c["shape"] == "round" }["id"]
    assert_not body["can_give"]
  end

  test "group admins design the chips; only changes from the default are kept" do
    @group.memberships.create!(user: @kim, role: "admin")
    @group.memberships.create!(user: @lee, role: "member")
    sign_in @lee
    put "/api/groups/#{@group.slug}/chips", params: { design: { round: { top_text: "Nope" } } }, as: :json
    assert_response :forbidden

    sign_in @kim
    design = ChipDesign::DEFAULT.deep_dup
    design["round"]["colors"]["30d"] = "#00FF00"
    design["round"]["emblem"] = "logo"
    design["round"]["finish"] = "shiny" # not a finish
    design["triangle"]["sides"] = ["One", "Two", "Three"]
    put "/api/groups/#{@group.slug}/chips", params: { design: design }, as: :json
    assert_response :success
    assert_equal({ "round" => { "emblem" => "logo", "colors" => { "30d" => "#00ff00" } }, "triangle" => { "sides" => %w[One Two Three] } }, @group.reload.chip_design)
    assert_equal "classic", response.parsed_body.dig("design", "round", "finish")
    assert_equal "#c62839", response.parsed_body.dig("default", "round", "colors", "30d")

    put "/api/groups/#{@group.slug}/chips", params: { reset: true }, as: :json
    assert_nil @group.reload.chip_design
  end

  test "deleting the account takes the inventories and lists with it" do
    @kim.step_inventories.create!(on: Date.current, notes: "x")
    @kim.gratitude_lists.create!(on: Date.current, items: ["y"])
    @kim.destroy!
    assert_equal 0, StepInventory.count
    assert_equal 0, GratitudeList.count
  end

  test "the recovery pages are for signed-in members and never indexed" do
    get "/recovery/inventory"
    assert_redirected_to "/users/sign_in"
    sign_in @lee
    get "/recovery/gratitude"
    assert_response :success
    assert_select "#recovery-root"
    assert_equal "noindex, nofollow", response.headers["X-Robots-Tag"]
  end

  test "a streak keeps through yesterday, and the best one is remembered" do
    [9, 8, 7, 5, 4, 3, 2, 1].each { |n| @kim.step_inventories.create!(on: Date.current - n) }
    sign_in @kim
    get "/api/step_inventories"
    assert_equal({ "current" => 5, "best" => 5 }, response.parsed_body["streak"])

    put "/api/step_inventories/#{day}", params: { answers: { afraid: { answer: "no" } } }, as: :json
    assert_equal({ "current" => 6, "best" => 6 }, response.parsed_body["streak"])
    assert_nil response.parsed_body["new_chip"]
    put "/api/step_inventories/#{day(6)}", params: { answers: { afraid: { answer: "no" } } }, as: :json
    assert_equal "inventory-streak:7", response.parsed_body.dig("new_chip", "id")
    assert_equal({ "current" => 10, "best" => 10 }, response.parsed_body["streak"])
  end

  test "hosts give a chip in their group's design to a member, who's told" do
    @group.update!(chip_design: { "round" => { "top_text" => "Acid Test" } })
    @group.memberships.create!(user: @lee, role: "member", can_host: true)
    @group.memberships.create!(user: @kim, role: "member")
    sign_in @kim
    post "/api/chip_awards", params: { group_slug: @group.slug, user_id: @lee.id, milestone_key: "30d" }, as: :json
    assert_response :forbidden, "only hosts, coordinators, record keepers and admins give chips"

    sign_in @lee
    get "/api/chip_awards"
    assert_equal [@group.slug], response.parsed_body["groups"].map { |g| g["slug"] }

    # Typing in To finds people in the group by name or email (names only), and accounts
    # outside it only by their whole address
    stranger = User.create!(email: "stranger@example.com", password: "password123", confirmed: true, name: "Sam Stranger")
    get "/api/chip_awards/lookup", params: { group_slug: @group.slug, q: "ki" }
    assert_equal [["Kim", @kim.id]], response.parsed_body["members"].map { |m| m.values_at("name", "id") }
    assert_not_includes response.body, "kim@example.com"
    get "/api/chip_awards/lookup", params: { group_slug: @group.slug, q: "stranger" }
    assert_equal [], response.parsed_body["members"]
    assert_nil response.parsed_body["account"]
    get "/api/chip_awards/lookup", params: { group_slug: @group.slug, q: "Stranger@example.com" }
    assert_equal ["Sam Stranger", false], response.parsed_body["account"].values_at("name", "member")
    get "/api/chip_awards/lookup", params: { group_slug: @other.slug, q: "ki" }
    assert_response :forbidden
    stranger.destroy!
    assert_difference -> { Notification.where(user: @kim, kind: "chip.given").count } do
      post "/api/chip_awards", params: { group_slug: @group.slug, user_id: @kim.id, milestone_key: "90d", on: day, note: "Keep coming back" }, as: :json
    end
    assert_response :created
    assert_not response.parsed_body["emailed"]

    sign_in @kim
    get "/api/recovery"
    body = response.parsed_body
    given = body["chips"].find { |c| c["source"] == "given" }
    assert_equal ["round:90d", "Acid Test", "The Acid Test", "Keep coming back"], [given["slot"], given.dig("design", "round", "top_text"), given.dig("group", "title"), given["note"]]
    # Two 90 day chips now: the one they earned stays on top until they pick the other
    assert_equal ["round:90d", true, 1], body["chips"].find { |c| c["id"] == "round:90d" }.values_at("slot", "top", "others")
    patch "/api/recovery", params: { top: { slot: "round:90d", id: given["id"] } }, as: :json
    assert response.parsed_body["chips"].find { |c| c["id"] == given["id"] }["top"]
    patch "/api/recovery", params: { top: { slot: "round:30d", id: given["id"] } }, as: :json
    assert_response :unprocessable_entity
  end

  test "a chip sent to an address with no account is emailed, and claimed by signing up with it" do
    @group.memberships.create!(user: @lee, role: "admin")
    sign_in @lee
    assert_enqueued_emails 1 do
      post "/api/chip_awards", params: { group_slug: @group.slug, email: "New@Example.com", milestone_key: "year", years: 2 }, as: :json
    end
    assert response.parsed_body["emailed"]
    award = ChipAward.last
    assert_equal ["new@example.com", "2 years", nil], [award.email, award.label, award.user]

    # Opened signed out, it waits while they make an account
    sign_out @lee
    get "/chips/claim/#{award.claim_token}"
    assert_redirected_to "/users/sign_up"
    get "/chips/claim/nope"
    assert_redirected_to "/"

    newcomer = User.create!(email: "new@example.com", password: "password123", name: "Nan")
    assert_nil award.reload.user
    newcomer.confirm
    assert_equal newcomer, award.reload.user

    # Their Chips page has it; the giver can take it back
    sign_in @lee
    get "/api/chip_awards"
    assert response.parsed_body["given"].sole["claimed"]
    delete "/api/chip_awards/#{award.id}", as: :json
    assert_response :no_content
    assert_equal 0, newcomer.chip_awards.count
  end

  test "a chip sent to someone with an account goes straight to them; a claim link opened signed in claims it" do
    @group.memberships.create!(user: @lee, role: "admin")
    sign_in @lee
    assert_no_enqueued_emails do
      post "/api/chip_awards", params: { group_slug: @group.slug, email: "KIM@example.com", milestone_key: "24h" }, as: :json
    end
    assert_equal @kim, ChipAward.last.user

    award = @group.chip_awards.create!(given_by: @lee, email: "someone@example.com", milestone_key: "6m", on: Date.current)
    sign_in @kim
    get "/chips/claim/#{award.claim_token}"
    assert_redirected_to "/recovery?chip=award:#{award.id}"
    assert_equal @kim, award.reload.user
  end

  test "Meeting Maker: a Join in the half hour before a meeting counts once it starts" do
    travel_to Time.zone.local(2026, 10, 28, 6, 20)
    meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: Date.current.wday, start_minute: 420, time_zone: Time.zone.name)
    @group.memberships.create!(user: @kim, role: "member")
    sign_in @kim
    post "/api/meeting_joins", params: { meeting_id: meeting.id }, as: :json
    assert_not response.parsed_body["counted"], "40 minutes early is too soon"

    travel_to Time.zone.local(2026, 10, 28, 6, 45)
    2.times { post "/api/meeting_joins", params: { meeting_id: meeting.id }, as: :json }
    assert response.parsed_body["counted"]
    assert_equal 1, MeetingJoin.count, "joining twice for one meeting counts once"
    get "/api/recovery"
    assert_empty response.parsed_body["chips"].select { |c| c["kind"] == "meeting" }, "not until it starts"

    travel_to Time.zone.local(2026, 10, 28, 7, 1)
    get "/api/recovery"
    chip = response.parsed_body["chips"].find { |c| c["kind"] == "meeting" }
    assert_equal ["meeting-#{meeting.id}:1", %w[Meeting Maker Sunrise]], [chip["id"], chip.dig("design", "triangle", "sides")]
    assert_equal 5, response.parsed_body["upcoming"].find { |c| c["kind"] == "meeting" }["count"]

    travel_to Time.zone.local(2026, 10, 28, 7, 10)
    post "/api/meeting_joins", params: { meeting_id: meeting.id }, as: :json
    assert_not response.parsed_body["counted"], "once it's started, the next one is a week away"
  end

  test "group admins give each meeting's Meeting Maker chips their own look" do
    meeting = @group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: 1, start_minute: 420)
    @group.memberships.create!(user: @kim, role: "admin")
    sign_in @kim
    put "/api/groups/#{@group.slug}/chips/meetings/#{meeting.id}", params: { design: { triangle: { sides: %w[Rise And Shine], colors: { meeting: "#123456" } } } }, as: :json
    assert_response :success
    assert_equal %w[Rise And Shine], ChipDesign.for_meeting(meeting.reload)["triangle"]["sides"]
    put "/api/groups/#{@group.slug}/chips/meetings/#{meeting.id}", params: { reset: true }, as: :json
    assert_equal %w[Meeting Maker Sunrise], ChipDesign.for_meeting(meeting.reload)["triangle"]["sides"]
  end

  test "a group's SVG logo becomes outlines for a raised relief, and nothing else of the file is kept" do
    @group.memberships.create!(user: @kim, role: "admin")
    sign_in @kim
    svg = <<~SVG
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50">
        <style>.dark{fill:#000}</style>
        <script>alert(1)</script>
        <rect width="100" height="50" fill="#ffffff"/>
        <g transform="translate(5 5)"><path class="dark" d="M0 0 L10 0 L10 10 Z" onclick="alert(1)"/></g>
        <circle cx="50" cy="25" r="10" style="fill: #808080"/>
        <path d="M1 1 L2 2" fill="none"/>
      </svg>
    SVG
    post "/api/groups/#{@group.slug}/chips/relief", params: { svg: svg }, as: :json
    relief = response.parsed_body["relief"]
    assert_equal [0.0, 0.0, 100.0, 50.0], relief["view_box"]
    assert_equal [0.0, 1.0, 0.5], relief["shapes"].map { |sh| sh["h"] }
    assert_equal "translate(5 5)", relief["shapes"][1]["t"]
    assert_not_includes relief.to_json, "alert"

    put "/api/groups/#{@group.slug}/chips", params: { design: { round: { emblem: "relief", relief: relief.merge("shapes" => relief["shapes"] + [{ "d" => "M0 0\"/><script>" }]) } } }, as: :json
    assert_equal 3, @group.reload.chip_design.dig("round", "relief", "shapes").size

    post "/api/groups/#{@group.slug}/chips/relief", params: { svg: "<svg><text>Hi</text></svg>" }, as: :json
    assert_response :unprocessable_entity
    assert_match "Outline any text", response.parsed_body["error"]
  end

  test "up to five favorite chips show on the profile, only if they turn it on" do
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @kim.update!(sobriety_date: Date.current - 800)
    sign_in @kim
    patch "/api/recovery", params: { favorites: %w[round:year-2 round:30d bogus round:24h round:60d round:90d round:6m round:9m] }, as: :json
    assert_equal %w[round:year-2 round:30d round:24h round:60d round:90d], @kim.reload.chip_favorites

    sign_in @lee
    get "/api/people/#{@kim.username}", as: :json
    assert_equal [], response.parsed_body.dig("context", "chips")

    # Turning it on adds a Chips block under About, which they can move like any other
    @kim.update!(show_chips_on_profile: true)
    assert_equal %w[about chips], @kim.page_blocks.select { |b| b["region"] == "side" }.first(2).map { |b| b["type"] }
    get "/api/people/#{@kim.username}", as: :json
    assert_equal %w[round:year-2 round:30d round:24h round:60d round:90d], response.parsed_body.dig("context", "chips").map { |c| c["id"] }
    assert response.parsed_body["blocks"].any? { |b| b["type"] == "chips" }

    @kim.update!(page_blocks: @kim.page_blocks.reject { |b| b["type"] == "chips" })
    get "/api/people/#{@kim.username}", as: :json
    assert_equal [], response.parsed_body.dig("context", "chips")
  ensure
    ENV.delete("GROUPS_FOR_EVERYONE")
  end
end

class ChipsTest < ActiveSupport::TestCase
  test "triangle chips at 1, 7, 30, 90, 180, 365, then every 365; streaks at 7, 30, 90, 180, 365" do
    assert_equal [1, 7, 30, 90, 180, 365, 730], Chips.triangle_counts(400)
    assert_equal 1095, Chips.next_count(730)
    today = Date.new(2026, 10, 28)
    days = (0..8).map { |n| today - 20 - n } + [today - 1, today - 2]
    s = Chips.streaks(days, today)
    assert_equal [2, 9, 30], s.values_at(:current, :best, :next)
    assert_equal [[7, today - 22]], s[:earned].map { |e| e.values_at(:count, :on) }
    assert_equal 0, Chips.streaks([today - 2], today)[:current]
    assert_equal [1, 5, 10, 25, 50, 100, 200], Chips.counts(Chips::MEETING_COUNTS, 120, 100)
  end

  test "a raised logo's settings keep to their ranges, and only what differs from the default is kept" do
    d = ChipDesign.normalize("round" => { "relief_depth" => "inset", "relief_size" => "90", "relief_height" => 11, "relief_sharpness" => "7", "relief_badge" => "1" })
    assert_equal({ "relief_depth" => "inset", "relief_size" => 90, "relief_badge" => true }, d["round"])
    assert_equal [4, 7, "raised"], ChipDesign.merge(nil)["round"].values_at("relief_height", "relief_sharpness", "relief_depth")
  end
end
