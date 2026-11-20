require "test_helper"

# Readings from AA Grapevine: the credit and source link, and the full text public only for a
# while around the meeting that last used it (Reading#full_text_for?)
class GrapevineReadingsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  BROWSER = { "User-Agent" => "Mozilla/5.0 Chrome" }.freeze
  STORY = "https://www.aagrapevine.org/magazine/1995/feb/fellowship-my-lifeline".freeze

  setup do
    Rails.application.reload_routes_unless_loaded
    @author = User.create!(email: "gv-author@example.com", name: "Author", password: "password123", confirmed: true)
    @member = User.create!(email: "gv-member@example.com", name: "Member", password: "password123", confirmed: true)
    @stranger = User.create!(email: "gv-stranger@example.com", name: "Stranger", password: "password123", confirmed: true)
    @group = Group.create!(title: "Grapevine Group", time_zone: "America/Chicago")
    @group.memberships.create!(user: @author, role: "member")
    @group.memberships.create!(user: @member, role: "member")
    @words = "The Fellowship gave me a life I never expected. #{'Every word of the story goes here. ' * 30}The secret ending line."
  end

  def grapevine_reading(meeting_on:, **attrs)
    Reading.create!(title: "The Fellowship Is My Lifeline", source: "AA Grapevine, February 1995", source_url: STORY,
                    content: @words, user: @author, group: @group, published_at: 10.days.ago, meetingDate: meeting_on, **attrs)
  end

  def page_reading
    JSON.parse(CGI.unescapeHTML(response.body[/data-reading="([^"]*)"/, 1]))
  end

  test "around its meeting, anyone reads the whole thing, with the credit and the Grapevine link" do
    reading = grapevine_reading(meeting_on: Date.current)

    get reading_path(reading), headers: BROWSER
    assert_response :success
    data = page_reading
    assert data["grapevine"]
    assert_equal STORY, data["read_on_url"]
    refute data["text_locked"]
    assert_includes data["content_html"], "The secret ending line."
  end

  test "after the window, the public sees an excerpt and the link, members still see it all" do
    reading = grapevine_reading(meeting_on: 5.days.ago.to_date)

    get reading_path(reading), headers: BROWSER
    data = page_reading
    assert data["text_locked"]
    assert_nil data["content_html"]
    assert_nil data["richer_content_html"]
    assert_operator data["excerpt"].size, :<=, Reading::EXCERPT_LENGTH
    assert_equal STORY, data["read_on_url"]
    refute_includes response.body, "The secret ending line."

    get reading_path(reading, format: :json), headers: BROWSER
    refute_includes response.body, "The secret ending line."

    sign_in @stranger
    get reading_path(reading), headers: BROWSER
    assert page_reading["text_locked"]
    get adoptable_reading_path(reading), headers: BROWSER
    assert_equal "", JSON.parse(response.body)["content_html"]

    sign_in @member
    get reading_path(reading), headers: BROWSER
    data = page_reading
    refute data["text_locked"]
    assert_includes data["content_html"], "The secret ending line."
  end

  test "the archive card shows only the opening lines once the window closes" do
    grapevine_reading(meeting_on: 5.days.ago.to_date)

    get "/readings", headers: BROWSER
    cards = JSON.parse(CGI.unescapeHTML(response.body[/data-readings="([^"]*)"/, 1]))
    card = cards.find { |c| c["title"] == "The Fellowship Is My Lifeline" }
    assert card["grapevine"]
    assert_operator card["preview"].size, :<=, Reading::EXCERPT_LENGTH
  end

  test "a host picking it for today's meeting opens it again" do
    reading = grapevine_reading(meeting_on: 30.days.ago.to_date)
    refute reading.public_text_open?

    reading.mark_used!(1.hour.ago)
    assert reading.reload.public_text_open?
    refute reading.public_text_open?(Reading::GRAPEVINE_PUBLIC_WINDOW.from_now)
    # An earlier use doesn't move it back
    reading.mark_used!(3.days.ago)
    assert_in_delta 1.hour.ago, reading.reload.last_used_at, 5
  end

  test "readings not from Grapevine are never held back" do
    reading = Reading.create!(title: "Own words", source: "My sponsor", content: @words, user: @author, published_at: 1.day.ago, meetingDate: 1.year.ago.to_date)
    refute reading.grapevine?
    assert reading.full_text_for?(nil)
  end

  test "a Grapevine reading with no link gets a search link for its title" do
    reading = grapevine_reading(meeting_on: Date.current, source_url: nil)
    get reading_path(reading), headers: BROWSER
    assert_equal "https://www.aagrapevine.org/site-search?keys=The%20Fellowship%20Is%20My%20Lifeline", page_reading["read_on_url"]
  end
end
