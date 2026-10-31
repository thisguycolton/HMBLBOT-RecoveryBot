require "test_helper"
require "minitest/mock"

# The little map of where an in-person meeting is (MeetingMap), with OpenStreetMap stubbed
class MeetingMapTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @tmp = Dir.mktmpdir
    @tile = File.join(@tmp, "tile.png")
    system(*ShareCard.magick, "-size", "256x256", "xc:#e8e4da", "-stroke", "#ffffff", "-strokewidth", "8", "-draw", "line 0,128 256,128", @tile, exception: true)
    FileUtils.rm_rf([MeetingMap::DIR, MeetingMap::TILE_DIR])
    @calls = []
    @get = lambda do |url|
      @calls << url
      url.include?("search") ? [{ lat: "33.4484", lon: "-112.0740" }].to_json : File.binread(@tile)
    end
  end

  teardown { FileUtils.rm_rf(@tmp) }

  test "looks up the address once, draws the map once, and keeps both" do
    group = Group.create!(title: "Central Group")
    meeting = group.meetings.create!(name: "Monday", day_of_week: 1, start_minute: 1140, location: "St. Mark's", formatted_address: "1234 N Central Ave, Phoenix, AZ")
    MeetingMap.stub(:get, @get) do
      path = MeetingMap.for(meeting).path
      assert File.exist?(path)
      assert_equal [33.4484, -112.074], [meeting.reload.latitude.to_f, meeting.longitude.to_f]
      geocodes = @calls.count { |u| u.include?("search") }
      tiles = @calls.size - geocodes
      assert_equal 1, geocodes
      assert_operator tiles, :>=, 4

      assert_equal path, MeetingMap.for(meeting.reload).path
      assert_equal 1 + tiles, @calls.size
    end
  end

  test "a meeting list's coordinates are used as they are, and a new address is looked up again" do
    list = MeetingDirectory.create!(name: "Phoenix Area Intergroup", key: "phx")
    feed = [{ slug: "m", name: "Monday", day: 1, time: "19:00", formatted_address: "1 Elm St, Mesa, AZ", latitude: "33.41", longitude: "-111.83" }].to_json
    MeetingListImport.new(list, text: feed).apply!(keys: ["phx-m"])
    listing = OiaaMeeting.find_by!(slug: "phx-m")
    assert_equal [33.41, -111.83], [listing.latitude.to_f, listing.longitude.to_f]

    group = Group.create!(title: "Elm Group")
    meeting = group.meetings.new.apply_oiaa(listing)
    meeting.save!
    assert_equal 33.41, meeting.latitude.to_f
    MeetingMap.stub(:get, @get) { MeetingMap.for(meeting).path }
    assert_empty @calls.select { |u| u.include?("search") }

    meeting.unlink_oiaa.update!(formatted_address: "9 Oak St, Mesa, AZ")
    assert_nil meeting.latitude
  end

  test "no place, or an address nobody can find: no map" do
    group = Group.create!(title: "Online Group")
    online = group.meetings.create!(name: "Zoom", day_of_week: 1, start_minute: 600, conference_url: "https://zoom.us/j/123456789")
    assert_nil MeetingMap.for(online)
    lost = group.meetings.create!(name: "Lost", day_of_week: 2, start_minute: 600, formatted_address: "Nowhere at all")
    MeetingMap.stub(:get, ->(_url) { "[]" }) { assert_nil MeetingMap.for(lost) }
  end
end
