require "test_helper"
require "minitest/mock"

class OiaaFeedTest < ActiveSupport::TestCase
  FEED = [
    { slug: "a1", name: "Sunrise Serenity", group: "Sunrise Group", day: [1, 3], time: "07:00", end_time: "08:00",
      timezone: "America/Phoenix", conference_url: "https://us02web.zoom.us/j/81234567890?pwd=x", types: %w[O D], notes: "<b>Bring</b> coffee" },
    { slug: "b2", name: "Night Owls", day: 5, time: "21:00", timezone: "America/New_York", conference_url: "https://meet.google.com/abc-defg-hij" },
    { slug: "c3", name: "Big Book Study", day: 1, time: "09:00", timezone: "America/Phoenix" },
    { name: "No slug" },
  ].to_json

  test "sync! caches the feed, one row per listing, cleaned up" do
    assert_equal 3, OiaaFeed.sync!(FEED)
    a = OiaaMeeting.find_by!(slug: "a1")
    assert_equal [[1, 3], "Sunrise Group", "81234567890", "Bring coffee"], [a.days, a.group_name, a.conference_id, a.notes]
    assert_equal "meet.google.com/abc-defg-hij", OiaaMeeting.find_by!(slug: "b2").conference_id
  end

  test "listings that drop out of the feed are flagged on linked meetings" do
    OiaaFeed.sync!(FEED)
    meeting = groups(:one).meetings.new.apply_oiaa(OiaaMeeting.find_by!(slug: "b2"))
    meeting.save!

    travel 1.minute do
      OiaaFeed.sync!([{ slug: "a1", name: "Sunrise Serenity (renamed)", day: [1], time: "07:15", timezone: "America/Phoenix" }].to_json)
    end
    assert meeting.reload.oiaa_missing
    assert_not_includes OiaaMeeting.listed.pluck(:slug), "b2"

    linked = groups(:two).meetings.new.apply_oiaa(OiaaMeeting.find_by!(slug: "a1"))
    linked.save!
    travel 2.minutes do
      OiaaFeed.sync!([{ slug: "a1", name: "Sunrise, renamed again", day: [1], time: "07:30", timezone: "America/Phoenix" }].to_json)
    end
    assert_equal ["Sunrise, renamed again", 450], [linked.reload.name, linked.start_minute]
  end

  test "Zoom IDs match however they're written" do
    assert_equal "81234567890", OiaaFeed.conference_id("https://zoom.us/j/81234567890")
    assert_equal "81234567890", OiaaFeed.conference_id("812 3456 7890")
    assert_nil OiaaFeed.conference_id("hello")
  end

  test "matches rank the same video meeting, then the same time, then the name" do
    OiaaFeed.sync!(FEED)
    by_link = OiaaFeed.matches(conference_url: "https://zoom.us/j/81234567890")
    assert_equal "a1", by_link.first[:record].slug
    assert_includes by_link.first[:reasons], "same video meeting"

    # 9:00 AM Eastern on a Monday is 6:00 AM Phoenix: no match. 7:00 Phoenix on Wednesday: a1.
    by_time = OiaaFeed.matches(day: 3, start_minute: 7 * 60, time_zone: "America/Phoenix", name: "Morning serenity")
    assert_equal "a1", by_time.first[:record].slug
    assert_equal 3, by_time.first[:day]

    by_name = OiaaFeed.matches(name: "big book")
    assert_equal ["c3"], by_name.map { |m| m[:record].slug }
    assert_empty OiaaFeed.matches(name: "zzz")
  end

  test "the feed is found through the page data.aa-intergroup.org answers with" do
    pages = { "https://data.aa-intergroup.org/" => %(done! <a href="6436f5a3.json">view json</a>),
              "https://data.aa-intergroup.org/6436f5a3.json" => "[]" }
    OiaaFeed.stub(:get, ->(url) { pages.fetch(url) }) do
      assert_equal "[]", OiaaFeed.fetch_feed("https://data.aa-intergroup.org/")
      assert_equal "[]", OiaaFeed.fetch_feed("https://data.aa-intergroup.org/6436f5a3.json")
    end
  end

  test "the feed is AA Intergroup's own unless one is set" do
    assert_equal "https://data.aa-intergroup.org/", OiaaFeed.feed_url
    ENV["AA_INTERGROUP_FEED_URL"] = "https://example.com/feed.json"
    assert_equal "https://example.com/feed.json", OiaaFeed.feed_url
  ensure
    ENV.delete("AA_INTERGROUP_FEED_URL")
  end
end
