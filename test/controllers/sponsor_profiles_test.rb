require "test_helper"

# "Available to sponsor" (SponsorProfile, Api::SponsorProfilesController): who can offer, who
# sees an offer, reporting one, and a site admin stopping someone offering
class SponsorProfilesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @pat = person("Pat", age: 2.weeks) # offering
    @sam = person("Sam") # looking
    @lee = person("Lee") # not in the group
    @group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    @group.memberships.create!(user: @pat, role: "member")
    @group.memberships.create!(user: @sam, role: "member")
  end

  teardown { ENV["ADMIN_EMAILS"] = @env }

  def person(name, age: 2.weeks, admin: false)
    User.create!(name: name, email: "#{name.downcase}@example.com", password: "password123", password_confirmation: "password123",
                 confirmed_at: Time.current, confirmed: true, created_at: age.ago, admin: admin)
  end

  def as(user)
    sign_out :user
    sign_in user
  end

  def offer!(user = @pat, **attrs) = SponsorProfile.for(user).tap { |p| p.update!(available: true, note: "Happy to help", **attrs) }

  def find_names
    get "/api/sponsor_profile/find"
    assert_response :success
    response.parsed_body["sponsors"].map { |s| s["person"]["name"] }
  end

  test "someone turns on their offer with picks, and people in their groups see it" do
    as @pat
    patch "/api/sponsor_profile", params: { available: true, note: "Big Book sponsor", picks: ["Newcomers (just getting started)", "Made up"],
                                            languages: "English, Spanish" }, as: :json
    assert_response :success
    profile = response.parsed_body["profile"]
    assert profile["available"]
    assert_equal ["Newcomers (just getting started)"], profile["picks"]

    as @sam
    get "/api/sponsor_profile/find"
    card = response.parsed_body["sponsors"].sole
    assert_equal ["Pat", "Big Book sponsor", ["Acid Test"]], [card["person"]["name"], card["note"], card["groups"]]
    assert_nil card["time_sober"]

    as @lee
    assert_empty find_names
  end

  test "an account has to be a week old to offer" do
    newbie = person("Nia", age: 2.days)
    as newbie
    patch "/api/sponsor_profile", params: { available: true }, as: :json
    assert_response :unprocessable_entity
    assert_match "week old", response.parsed_body["error"]
    get "/api/sponsor_profile"
    assert_not response.parsed_body["profile"]["old_enough"]
  end

  test "blocked either way, full, or a group that turned the list off hides an offer" do
    offer!
    as @sam
    assert_equal ["Pat"], find_names

    UserBlock.create!(blocker: @pat, blocked: @sam)
    assert_empty find_names
    UserBlock.delete_all
    assert_equal ["Pat"], find_names

    SponsorProfile.for(@pat).update!(max_sponsees: 1)
    Sponsorship.create!(sponsor: @pat, sponsee: @lee, status: "active", started_on: Date.current)
    assert_empty find_names
    SponsorProfile.for(@pat).update!(max_sponsees: nil)

    @group.update!(show_sponsors: false)
    assert_empty find_names
  end

  test "an offer can be reported by someone who can see it, and a site admin can stop and allow it" do
    offer!
    as @lee
    post "/api/user_reports", params: { subject_type: "sponsor_profile", subject_id: SponsorProfile.for(@pat).id, reason: "Not ok" }, as: :json
    assert_response :not_found

    as @sam
    post "/api/user_reports", params: { subject_type: "sponsor_profile", subject_id: SponsorProfile.for(@pat).id, reason: "Not ok" }, as: :json
    assert_response :created
    report = UserReport.last
    assert_equal [@pat, "Happy to help"], [report.user, report.quote]

    as person("Boss", admin: true)
    patch "/api/admin/user_reports/#{report.id}", params: { sponsoring: "stop" }, as: :json
    assert_response :success
    assert_equal "stopped", response.parsed_body["sponsoring"]
    assert_not SponsorProfile.for(@pat).available

    as @sam
    assert_empty find_names
    as @pat
    patch "/api/sponsor_profile", params: { available: true }, as: :json
    assert_response :unprocessable_entity

    as User.find_by(email: "boss@example.com")
    patch "/api/admin/user_reports/#{report.id}", params: { sponsoring: "allow" }, as: :json
    as @pat
    patch "/api/sponsor_profile", params: { available: true }, as: :json
    assert_response :success
  end

  test "time sober shows only when they choose to" do
    @pat.update!(sobriety_date: 3.years.ago.to_date)
    offer!(show_time_sober: true)
    as @sam
    get "/api/sponsor_profile/find"
    assert_equal "3 years", response.parsed_body["sponsors"].sole["time_sober"]
  end
end
