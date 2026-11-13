require "test_helper"

# Local meeting lists (MeetingListImport): in-person meetings from a Meeting Guide feed or a CSV
class MeetingListImportTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  FEED = [
    { slug: "monday-night", name: "Monday Night Group", day: 1, time: "19:00", end_time: "20:00", types: %w[O D X],
      location: "St. Mark's Church", formatted_address: "1234 N Central Ave, Phoenix, AZ 85004, USA", notes: "Back room",
      location_notes: "Park in the rear lot", regions: %w[Phoenix Central] },
    { slug: "hybrid-saturday", name: "Saturday Hybrid", day: [6], time: "09:00", address: "50 W Main St", city: "Mesa",
      state: "AZ", postal_code: "85201", conference_url: "https://zoom.us/j/81234567890" },
    { slug: "gone", name: "Closed Down", day: 2, time: "12:00", attendance_option: "inactive", formatted_address: "1 Elm St" },
    { slug: "no-day", name: "Mystery Meeting", time: "12:00", formatted_address: "2 Elm St" },
  ].to_json

  setup do
    @list = MeetingDirectory.create!(name: "Phoenix Area Intergroup", key: "phx", time_zone: "America/Phoenix")
  end

  test "preview reads the feed, saves nothing, and says what can't be used" do
    preview = MeetingListImport.new(@list, text: FEED).preview
    assert_equal 0, OiaaMeeting.count
    by_name = preview[:rows].index_by { |r| r[:listing][:name] }
    assert_equal %w[new new skipped skipped], preview[:rows].map { |r| r[:status] }
    assert_equal "in_person", by_name["Monday Night Group"][:listing][:attendance]
    assert_equal "hybrid", by_name["Saturday Hybrid"][:listing][:attendance]
    assert_equal "50 W Main St, Mesa, AZ, 85201", by_name["Saturday Hybrid"][:listing][:address]
    assert_equal "Listed as inactive", by_name["Closed Down"][:reason]
    assert_match "No day", by_name["Mystery Meeting"][:reason]
    assert by_name["Monday Night Group"][:selected]
  end

  test "import adds listings that Find a meeting shows, then updates without deleting" do
    import = MeetingListImport.new(@list, text: FEED)
    keys = import.preview[:rows].select { |r| r[:selected] }.map { |r| r[:key] }
    assert_equal({ saved: 2, hidden: 0 }, import.apply!(keys: keys))

    monday = OiaaMeeting.find_by!(slug: "phx-monday-night")
    assert_equal [@list, [1], "America/Phoenix", "Park in the rear lot", "Phoenix > Central"],
                 [monday.meeting_directory, monday.days, monday.time_zone, monday.location_notes, monday.region]
    assert_equal "Phoenix Area Intergroup", monday.source_name
    assert_includes OiaaMeeting.listed, monday

    # a group links its meeting to the listing: it takes the place too
    group = Group.create!(title: "Monday Night Group")
    linked = group.meetings.new.apply_oiaa(monday)
    linked.save!
    assert_equal "1234 N Central Ave, Phoenix, AZ 85004, USA", linked.formatted_address

    # next import: one changed time, one gone from the source
    changed = JSON.parse(FEED).first.merge("time" => "19:30").to_json
    again = MeetingListImport.new(@list, text: "[#{changed}]")
    preview = again.preview
    assert_equal ["changed"], preview[:rows].map { |r| r[:status] }
    assert_includes preview[:rows].first[:changes], "start_time"
    assert_equal ["phx-hybrid-saturday"], preview[:missing].map { |m| m[:key] }

    again.apply!(keys: ["phx-monday-night"])
    assert_equal 1170, linked.reload.start_minute
    # not ticked to hide: still listed
    assert_includes OiaaMeeting.listed.pluck(:slug), "phx-hybrid-saturday"

    MeetingListImport.new(@list, text: "[#{changed}]").apply!(keys: [], hide: ["phx-hybrid-saturday"])
    assert_not_includes OiaaMeeting.listed.pluck(:slug), "phx-hybrid-saturday"
    assert OiaaMeeting.exists?(slug: "phx-hybrid-saturday")
  end

  test "a listing's group description imports, shows as a change, and fills in a linked group's blank one" do
    MeetingListImport.new(@list, text: FEED).apply!(keys: %w[phx-monday-night])
    group = Group.create!(title: "Monday Night Group")
    group.meetings.new.apply_oiaa(OiaaMeeting.find_by!(slug: "phx-monday-night")).save!

    described = JSON.parse(FEED).first.merge("group_notes" => "A friendly <i>step</i> meeting.").to_json
    import = MeetingListImport.new(@list, text: "[#{described}]")
    row = import.preview[:rows].first
    assert_equal ["changed", ["group_notes"]], [row[:status], row[:changes]]
    import.apply!(keys: [row[:key]])
    assert_equal "A friendly step meeting.", OiaaMeeting.find_by!(slug: "phx-monday-night").group_notes
    assert_equal "A friendly step meeting.", group.reload.description

    csv = "Name,Day,Time,Address,Group Notes\nTuesday Talk,Tuesday,7:00 PM,1 Elm St,Come early for coffee\n"
    MeetingListImport.new(@list, text: csv).then { |i| i.apply!(keys: i.preview[:rows].map { |r| r[:key] }) }
    assert_equal "Come early for coffee", @list.listings.find_by!(name: "Tuesday Talk").group_notes
  end

  test "an AA Intergroup sync doesn't drop imported listings or flag meetings linked to them" do
    import = MeetingListImport.new(@list, text: FEED)
    import.apply!(keys: ["phx-monday-night"])
    group = Group.create!(title: "Somewhere")
    linked = group.meetings.new.apply_oiaa(OiaaMeeting.find_by!(slug: "phx-monday-night"))
    linked.save!

    travel 1.minute do
      OiaaFeed.sync!([{ slug: "oiaa-1", name: "Online Thing", day: [1], time: "07:00", timezone: "America/Phoenix" }].to_json)
    end
    assert_includes OiaaMeeting.listed.pluck(:slug), "phx-monday-night"
    assert_not linked.reload.oiaa_missing
  end

  test "possible duplicates of meetings already listed are flagged and left unticked" do
    OiaaFeed.sync!([{ slug: "oiaa-sat", name: "Saturday Hybrid Group", day: [6], time: "09:00", timezone: "America/Phoenix",
                      conference_url: "https://zoom.us/j/81234567890", formatted_address: "50 W Main St, Mesa, AZ" }].to_json)
    group = Group.create!(title: "Central Group")
    group.meetings.create!(name: "Monday Night", day_of_week: 1, start_minute: 19 * 60, end_minute: 20 * 60, time_zone: "America/Phoenix")

    rows = MeetingListImport.new(@list, text: FEED).preview[:rows].index_by { |r| r[:listing][:name] }
    sat = rows["Saturday Hybrid"]
    assert_equal ["AA Intergroup"], sat[:duplicates].map { |d| d[:source] }.uniq
    assert_not sat[:selected]
    monday = rows["Monday Night Group"]
    assert_equal [["meeting", "Central Group"]], monday[:duplicates].map { |d| [d[:kind], d[:source]] }
    assert_not monday[:selected]
  end

  test "a CSV in 12 Step Meeting List's columns, one row per day" do
    csv = <<~CSV
      Day,Time,End Time,Name,Location,Address,City,State,Postal Code,Types,Notes,Group
      Monday,7:00 PM,8:00 PM,Sober Sunrise,Grace Hall,10 E Oak St,Tempe,AZ,85281,"Open, Big Book, Wheelchair Access",,Sunrise Group
      Wednesday,7:00 PM,8:00 PM,Sober Sunrise,Grace Hall,10 E Oak St,Tempe,AZ,85281,"Open, Big Book, Wheelchair Access",,Sunrise Group
      Fri,6:30am,,Early Birds,,22 S Elm St,Tempe,AZ,,C,Coffee,
      Someday,7pm,,Bad Day,,1 A St,Tempe,AZ,,,,
    CSV
    import = MeetingListImport.new(@list, text: csv)
    rows = import.preview[:rows]
    assert_equal %w[new new skipped], rows.map { |r| r[:status] }
    sunrise = rows.first[:listing]
    assert_equal [[1, 3], "19:00", "20:00", %w[O B X], "Sunrise Group"],
                 [sunrise[:days], sunrise[:start_time], sunrise[:end_time], sunrise[:types], sunrise[:group_name]]
    assert_equal ["06:30", %w[C]], [rows.second[:listing][:start_time], rows.second[:listing][:types]]

    import.apply!(keys: rows.first(2).map { |r| r[:key] })
    assert_equal 2, @list.listings.count
  end

  test "a CSV without the needed columns, or nothing usable, says so" do
    assert_raises(MeetingListImport::Error) { MeetingListImport.new(@list, text: "Foo,Bar\n1,2\n").preview }
    assert_raises(MeetingListImport::Error) { MeetingListImport.new(@list, text: "[]").preview }
    assert_raises(MeetingListImport::Error) { MeetingListImport.new(@list, text: "{nope").preview }
  end

  # The shape a WordPress 12 Step Meeting List feed (wp-admin/admin-ajax.php?action=meetings)
  # has, trimmed from a big-city intergroup's: one row per day, days as strings or numbers,
  # coordinates as strings or numbers (0 for none), extra fields we don't use.
  test "a 12 Step Meeting List feed previews and imports" do
    feed = file_fixture("tsml_feed_sample.json").read
    import = MeetingListImport.new(@list, text: feed)
    rows = import.preview[:rows]
    assert_equal %w[new new new skipped], rows.map { |r| r[:status] }
    assert_equal "Listed as inactive", rows.last[:reason]

    import.apply!(keys: rows.select { |r| r[:selected] }.map { |r| r[:key] })
    birds = OiaaMeeting.find_by!(slug: "phx-lincoln-park-early-birds")
    assert_equal [[1, 3], "07:00", "08:00", %w[O D X], "Early Birds Group", "in_person", "North Side > Lincoln Park", "Coffee & donuts"],
                 [birds.days, birds.start_time, birds.end_time, birds.types, birds.group_name, birds.attendance_option, birds.region, birds.notes]
    assert_equal [41.9283, -87.6455], [birds.latitude.to_f, birds.longitude.to_f]

    lunch = OiaaMeeting.find_by!(slug: "phx-loop-lunch-bunch")
    assert_equal ["hybrid", %w[C BE ST LGBTQ], "81234567890", 41.8791], [lunch.attendance_option, lunch.types, lunch.conference_id, lunch.latitude.to_f]
    owls = OiaaMeeting.find_by!(slug: "phx-night-owls-online")
    assert_equal ["online", nil], [owls.attendance_option, owls.latitude]
  end

  test "a feed saved from a browser as a web page still imports" do
    json = file_fixture("tsml_feed_sample.json").read
    page = "<html><head><title>admin-ajax.php</title></head><body><pre style=\"word-wrap: break-word\">#{ERB::Util.html_escape(json)}</pre></body></html>"
    rows = MeetingListImport.new(@list, text: page).preview[:rows]
    assert_equal %w[new new new skipped], rows.map { |r| r[:status] }
  end
end

