require "test_helper"

# Step work settings: the 10th step's own questions (InventoryQuestions), a worksheet's reminder
# (RecoveryReminders.remind_work), sending a worksheet to the sponsor as it's written, and the
# green check on people available to sponsor
class StepSettingsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @sam = person("Sam")
    @pat = person("Pat")
    sign_in @sam
  end

  def person(name)
    User.create!(name: name, email: "#{name.downcase}@example.com", password: "password123", password_confirmation: "password123",
                 confirmed_at: Time.current, confirmed: true, created_at: 1.month.ago)
  end

  test "their own 10th step questions; nights already written keep theirs" do
    put "/api/step_inventories/2026-10-30", params: { answers: { resentful: { answer: "yes", note: "Boss" } } }, as: :json
    assert_response :success

    get "/api/inventory_questions"
    assert_equal InventoryQuestions::DEFAULT, response.parsed_body["questions"]
    assert_equal 3, response.parsed_body["templates"].size

    patch "/api/inventory_questions", params: { questions: [{ key: "resentful", text: "Did a resentment come up?", open: false },
                                                            { text: "What am I grateful for tonight?", open: true }] }, as: :json
    assert_response :success
    mine = response.parsed_body["questions"]
    assert_equal ["Did a resentment come up?", "What am I grateful for tonight?"], mine.map { |q| q["text"] }
    assert response.parsed_body["custom"]

    put "/api/step_inventories/2026-10-31", params: { answers: { mine[1]["key"] => { note: "Coffee" }, kind: { answer: "yes" } } }, as: :json
    entry = response.parsed_body["entry"]
    assert_equal mine, entry["questions"]
    assert_equal({ mine[1]["key"] => { "answer" => nil, "note" => "Coffee" } }, entry["answers"])

    get "/api/step_inventories/2026-10-30"
    assert_equal InventoryQuestions::DEFAULT, response.parsed_body.dig("entry", "questions")

    patch "/api/inventory_questions", params: { questions: [] }, as: :json
    assert_response :unprocessable_entity
    patch "/api/inventory_questions", params: { reset: true }, as: :json
    assert_nil @sam.reload.inventory_questions
  end

  test "a worksheet's reminder goes out at its time on its days, unless they worked on it that day" do
    @sam.update!(time_zone: "America/Phoenix")
    phoenix = ActiveSupport::TimeZone["America/Phoenix"]
    work = travel_to(phoenix.parse("2026-11-01 08:00")) do # the Sunday before
      w = StepWork.start!(@sam, StepTool.find("step4-big-book"))
      w.update!(remind_at: "19:00", remind_days: [1, 3])
      w
    end
    travel_to(phoenix.parse("2026-11-02 19:05")) { RecoveryReminders.send_due! } # Monday
    note = @sam.notifications.sole
    assert_equal ["recovery.step_work_reminder", "/recovery/steps/#{work.id}"], [note.kind, note.url]
    assert_equal "recovery_reminders", Notification.push_category(note.kind)

    travel_to(phoenix.parse("2026-11-03 19:05")) { RecoveryReminders.send_due! } # Tuesday: not a day picked
    assert_equal 1, @sam.notifications.count
    travel_to(phoenix.parse("2026-11-04 18:00")) { work.update!(answers: { "resentments" => [{ "who" => "Boss" }] }) }
    travel_to(phoenix.parse("2026-11-04 19:05")) { RecoveryReminders.send_due! } # worked on it already
    assert_equal 1, @sam.notifications.count
  end

  test "sending as they write keeps one unread copy per worksheet with the sponsor, told once" do
    link = Sponsorship.create!(sponsor: @pat, sponsee: @sam, status: "active", started_on: Date.current)
    post "/api/step_works", params: { tool_key: "step4-big-book" }, as: :json
    id = response.parsed_body.dig("work", "id")

    patch "/api/step_works/#{id}", params: { answers: { resentments: [{ who: "Boss" }] }, send_text: "Boss" }, as: :json
    assert_empty link.shares # off by default

    patch "/api/step_works/#{id}", params: { auto_send: true, send_text: "Boss" }, as: :json
    assert response.parsed_body.dig("work", "auto_send")
    patch "/api/step_works/#{id}", params: { answers: { resentments: [{ who: "Boss" }, { who: "Dad" }] }, send_text: "Boss\nDad" }, as: :json
    share = link.shares.sole
    assert_equal ["step_work", "Boss\nDad"], [share.kind, share.body]
    assert_equal 1, @pat.notifications.where(kind: "sponsorship.share").count

    share.update!(seen_at: Time.current)
    patch "/api/step_works/#{id}", params: { send_text: "Boss\nDad\nMe" }, as: :json
    assert_equal 2, link.shares.count
    assert_equal 2, @pat.notifications.where(kind: "sponsorship.share").count
  end

  test "group members see the green check on people offering to sponsor" do
    group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    [@sam, @pat].each { |u| group.memberships.create!(user: u, role: "member") }
    SponsorProfile.create!(user: @pat, available: true)

    get "/api/groups/#{group.slug}"
    checks = response.parsed_body["members"].to_h { |m| [m["name"], m["can_sponsor"]] }
    assert_equal({ "Pat" => true, "Sam" => false }, checks)

    group.update!(show_sponsors: false)
    get "/api/groups/#{group.slug}"
    assert response.parsed_body["members"].none? { |m| m["can_sponsor"] }
  end
end
