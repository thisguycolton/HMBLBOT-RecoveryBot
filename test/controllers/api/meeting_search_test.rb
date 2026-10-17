require "test_helper"

class Api::MeetingSearchTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  PHOENIX = "America/Phoenix" # no daylight time, so these times hold all year

  setup do
    Rails.application.reload_routes_unless_loaded
    @previous = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "admin@example.com"
    @admin = User.create!(email: "admin@example.com", name: "Colton", password: "password123", confirmed: true, admin: true)
    @stranger = User.create!(email: "stranger@example.com", name: "Sam", password: "password123", confirmed: true)
    Meeting.delete_all
  end

  teardown { ENV["ADMIN_EMAILS"] = @previous }

  def find(**params)
    get "/api/meeting_search", params: { time_zone: PHOENIX, **params }, as: :json
    assert_response :success
    response.parsed_body
  end

  def keys(body) = body["meetings"].map { |m| m["key"] }

  # Monday 2026-10-19, 6:00 PM in Phoenix
  def at_monday_evening(&) = travel_to(Time.find_zone(PHOENIX).parse("2026-10-19 18:00"), &)

  def sync
    OiaaFeed.sync!([
      { slug: "mon-7pm", name: "Monday Night Speaker", group: "Desert Light", day: [1], time: "19:00", end_time: "20:00",
        timezone: PHOENIX, conference_url: "https://zoom.us/j/81234567890", types: %w[O SP] },
      { slug: "mon-530pm", name: "Happy Hour", day: [1], time: "17:30", end_time: "18:30", timezone: PHOENIX,
        conference_url: "https://zoom.us/j/81234567891", types: %w[C D] },
      # 9:00 PM Eastern = 6:00 PM Phoenix on Wednesdays while the East is on daylight time
      { slug: "wed-9pm-et", name: "Night Owls East", day: [3], time: "21:00", timezone: "America/New_York",
        conference_url: "https://zoom.us/j/81234567892", types: %w[W] },
      { slug: "tue-hybrid", name: "Tuesday Breakfast", day: [2], time: "07:00", timezone: PHOENIX, attendance_option: "hybrid",
        formatted_address: "123 Main St, Tempe, AZ 85281, USA", conference_url: "https://zoom.us/j/81234567893" },
      { slug: "gone", name: "Closed Down", day: [1], time: "19:00", timezone: PHOENIX, attendance_option: "inactive" },
    ].to_json)
  end

  test "anyone can search, with or without an account" do
    sign_in @stranger
    get "/api/meeting_search", as: :json
    assert_response :success
    sign_out @stranger
    get "/api/meeting_search", as: :json
    assert_response :success
  end

  test "the coming week, soonest first, with what's on now" do
    at_monday_evening do
      sync
      sign_in @admin
      body = find
      assert_equal %w[oiaa-mon-530pm oiaa-mon-7pm oiaa-tue-hybrid oiaa-wed-9pm-et], keys(body)
      happy = body["meetings"].first
      assert happy["live"], "5:30–6:30 is on at 6:00"
      assert_equal Time.find_zone(PHOENIX).parse("2026-10-19 17:30"), Time.zone.parse(happy["starts_at"])
      assert_equal({ "title" => "Happy Hour", "here" => false, "href" => "/find/mon-530pm" }, happy["group"].slice("title", "here", "href"))
      assert_equal 4, body["total"]
      assert_equal "Desert Light", body["meetings"].second.dig("group", "title")
    end
  end

  test "filters: words, a date, the viewer's time of day, live, where and type" do
    at_monday_evening do
      sync
      sign_in @admin
      assert_equal %w[oiaa-mon-7pm], keys(find(q: "desert light"))
      assert_equal %w[oiaa-mon-7pm], keys(find(q: "https://us02web.zoom.us/j/81234567890?pwd=abc"))
      assert_equal %w[oiaa-wed-9pm-et], keys(find(date: "2026-10-21"))
      assert_empty keys(find(date: "2026-10-18")), "a past day finds nothing"

      # Evening in Phoenix (5–9 PM): Night Owls' 9:00 PM Eastern is 6:00 PM here
      assert_equal %w[oiaa-mon-530pm oiaa-mon-7pm oiaa-wed-9pm-et], keys(find(from: 1020, to: 1260))
      # ...and in New York the same filter is a different set
      get "/api/meeting_search", params: { time_zone: "America/New_York", from: 1260, to: 1320 }, as: :json
      assert_equal %w[oiaa-wed-9pm-et], keys(response.parsed_body)

      assert_equal %w[oiaa-mon-530pm], keys(find(live: "1"))
      assert_equal %w[oiaa-tue-hybrid], keys(find(attendance: "in_person"))
      assert_equal %w[oiaa-tue-hybrid], keys(find(place: "tempe"))
      assert_equal %w[oiaa-wed-9pm-et], keys(find(place: "eastern"))
      assert_equal %w[oiaa-mon-7pm], keys(find(type: "SP"))
      assert_equal ["hybrid", "123 Main St, Tempe, AZ 85281, USA"], find(place: "tempe")["meetings"].first.values_at("attendance", "place")
    end
  end

  test "a listing that's one of a group's meetings shows as the group's, and groups' own meetings show too" do
    at_monday_evening do
      sync
      group = groups(:one)
      group.meetings.new.apply_oiaa(OiaaMeeting.find_by!(slug: "mon-7pm")).save!
      group.meetings.create!(name: "Sunrise Step Study", day_of_week: 2, start_minute: 360, time_zone: PHOENIX, location: "Fellowship Hall")
      group.meetings.create!(name: "Picnic", recurrence: "once", starts_at: Time.current + 2.days, time_zone: PHOENIX)
      sign_in @admin

      body = find
      mon = body["meetings"].find { |m| m["key"] == "oiaa-mon-7pm" }
      assert_equal({ "title" => "Sunrise Serenity", "here" => true, "href" => "/sunrise-serenity" }, mon["group"].slice("title", "here", "href"))
      assert_equal 1, body["meetings"].count { |m| m["name"] == "Monday Night Speaker" }, "the linked meeting isn't listed twice"
      step = body["meetings"].find { |m| m["name"] == "Sunrise Step Study" }
      assert_equal ["in_person", "Fellowship Hall"], [step["attendance"], step["place"]]
      assert_includes keys(body), "meeting-#{group.meetings.find_by!(name: 'Picnic').id}"
      assert_equal %w[Sunrise\ Step\ Study], find(q: "step study")["meetings"].map { |m| m["name"] }
    end
  end

  test "pages of results" do
    at_monday_evening do
      OiaaFeed.sync!(30.times.map { |i| { slug: "m#{i}", name: "Meeting #{i}", day: [i % 7], time: "12:00", timezone: PHOENIX } }.to_json)
      sign_in @admin
      first = find
      assert_equal [30, 2, 24], [first["total"], first["pages"], first["meetings"].size]
      second = find(page: 2)
      assert_equal 6, second["meetings"].size
      assert_empty keys(first) & keys(second)
      assert_equal 2, find(page: 99)["page"]
    end
  end

  test "a group's meetings and its AA Intergroup page say when the next one is" do
    at_monday_evening do
      sync
      meeting = groups(:one).meetings.create!(name: "Evening", day_of_week: 1, start_minute: 17 * 60 + 30, end_minute: 18 * 60 + 30, time_zone: PHOENIX)
      assert_equal %w[2026-10-19T17:30:00-07:00 2026-10-19T18:30:00-07:00], meeting.as_api_json.values_at(:upcoming_start, :upcoming_end)

      sign_in @admin
      get "/api/intergroup_pages/mon-7pm", as: :json
      listing = response.parsed_body.dig("context", "meetings").first
      assert_equal "2026-10-19T19:00:00-07:00", listing["upcoming_start"]
    end
  end
end
