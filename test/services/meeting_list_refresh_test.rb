require "test_helper"

# The weekly refresh of local meeting lists (MeetingListRefresh) and adding many at once
class MeetingListRefreshTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  FEED = [
    { slug: "mon", name: "Monday Night Group", day: 1, time: "19:00", formatted_address: "1234 N Central Ave, Phoenix, AZ" },
    { slug: "sat", name: "Saturday Morning", day: 6, time: "09:00", formatted_address: "50 W Main St, Mesa, AZ" },
  ].freeze

  setup do
    @list = MeetingDirectory.create!(name: "Phoenix Area Intergroup", key: "phx", feed_url: "https://example.org/feed")
    @feed = FEED.to_json
    feed = -> { @feed }
    OiaaFeed.singleton_class.alias_method(:__real_fetch_feed, :fetch_feed)
    OiaaFeed.define_singleton_method(:fetch_feed) { |_url = nil| feed.call }
  end

  teardown do
    OiaaFeed.singleton_class.alias_method(:fetch_feed, :__real_fetch_feed)
    OiaaFeed.singleton_class.remove_method(:__real_fetch_feed)
  end

  test "a due list imports new and changed meetings, then waits a week" do
    assert_equal [@list], MeetingListRefresh.due.to_a
    assert_equal 1, MeetingListRefresh.refresh_due!
    @list.reload
    assert_equal ["ok", 2], [@list.refresh_status, @list.refresh_result["new"]]
    assert_equal 2, @list.listings.count
    assert_empty MeetingListRefresh.due
    assert_equal [@list], MeetingListRefresh.due(8.days.from_now).to_a

    # a week later: one changed, one gone from the feed. Nothing is taken off.
    @feed = [FEED.first.merge(time: "19:30")].to_json
    MeetingListRefresh.refresh!(@list)
    @list.reload
    assert_equal "review", @list.refresh_status
    assert_equal({ "new" => 0, "changed" => 1, "duplicates" => 0, "missing" => 1, "skipped" => 0, "meetings" => 1 }, @list.refresh_result)
    assert_equal "19:30", OiaaMeeting.find_by!(slug: "phx-mon").start_time
    assert_nil OiaaMeeting.find_by!(slug: "phx-sat").hidden_at
  end

  test "possible duplicates and listings an admin took off wait for review" do
    other = MeetingDirectory.create!(name: "Valley Intergroup", key: "valley")
    MeetingListImport.new(other, text: [FEED.first.merge(slug: "monday")].to_json).apply!(keys: ["valley-monday"])
    MeetingListRefresh.refresh!(@list)
    @list.reload
    assert_equal ["review", 1, 1], [@list.refresh_status, @list.refresh_result["new"], @list.refresh_result["duplicates"]]
    assert_nil OiaaMeeting.find_by(slug: "phx-mon")

    OiaaMeeting.find_by!(slug: "phx-sat").update!(hidden_at: Time.current)
    @list.update_columns(refreshed_at: 8.days.ago)
    MeetingListRefresh.refresh!(@list)
    assert OiaaMeeting.find_by!(slug: "phx-sat").hidden_at
  end

  test "a feed that fails is recorded and tried again a day later" do
    OiaaFeed.define_singleton_method(:fetch_feed) { |_url = nil| raise OiaaFeed::Error, "https://example.org/feed answered 500" }
    MeetingListRefresh.refresh!(@list)
    @list.reload
    assert_equal ["error", "https://example.org/feed answered 500"], [@list.refresh_status, @list.refresh_error]
    assert_nil @list.refresh_started_at
    assert_empty MeetingListRefresh.due
    assert_equal [@list], MeetingListRefresh.due(25.hours.from_now).to_a
  end

  test "lists without a feed link, or with the refresh off, aren't due; one refreshing isn't claimed twice" do
    MeetingDirectory.create!(name: "File Only", key: "file")
    MeetingDirectory.create!(name: "Off", key: "off", feed_url: "https://example.com/f", auto_refresh: false)
    assert_equal [@list], MeetingListRefresh.due.to_a
    assert MeetingListRefresh.claim(@list)
    refute MeetingListRefresh.refresh!(@list)
  end

  test "bulk add reads names, links and time zones, and skips what it can't use" do
    text = <<~TEXT
      Name,Feed
      East Valley Intergroup, https://www.evaa.org/wp-admin/admin-ajax.php?action=meetings
      https://aatucson.org/wp-admin/admin-ajax.php?action=meetings\tAmerica/Denver
      Denver Central Office\thttps://daccaa.org/meetings.json\tAmerica/Denver
      Again, https://example.org/feed
      East Valley Intergroup two, https://www.evaa.org/wp-admin/admin-ajax.php?action=meetings
    TEXT
    result = MeetingDirectory.bulk_add(text, time_zone: "America/Phoenix")
    added = result[:added].map { |d| [d.name, d.key, d.time_zone, d.website] }
    assert_equal [["East Valley Intergroup", "east-valley-inter", "America/Phoenix", "https://www.evaa.org"],
                  ["aatucson.org", "aatucson-org", "America/Denver", "https://aatucson.org"],
                  ["Denver Central Office", "denver-central-of", "America/Denver", "https://daccaa.org"]], added
    assert_equal ["No link in this line", "Already added", "Already added"], result[:skipped].map { |s| s[:reason] }

    assert_equal "east-valley-inter-2", MeetingDirectory.unique_key("East Valley Intergroup")
  end
end
