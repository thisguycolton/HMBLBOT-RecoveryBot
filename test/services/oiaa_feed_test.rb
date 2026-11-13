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

  test "a listing's group description is kept, paragraphs and all, and fills in a linked group's blank one" do
    feed = [{ slug: "cm1", name: "Crazy Monkey AA Group", group: "Crazy Monkey AA Group", day: 0, time: "03:00", timezone: "America/Los_Angeles",
              group_notes: "We are a zoom only meeting.\nWe read from AA literature &amp;amp; talk.\n\n\nWe invite all.<script>x</script>\n\n" },
            { slug: "p2", name: "Paragraphs", day: 1, time: "07:00", group_notes: "<p>First <b>one</b></p><p>Second<br>line</p>" }]
    OiaaFeed.sync!(feed.to_json)
    assert_equal "We are a zoom only meeting.\nWe read from AA literature & talk.\n\nWe invite all.", OiaaMeeting.find_by!(slug: "cm1").group_notes
    assert_equal "First one\nSecond\nline", OiaaMeeting.find_by!(slug: "p2").group_notes

    blank = groups(:one).tap { |g| g.update_columns(description: nil) }
    own = groups(:two).tap { |g| g.update_columns(description: "Our own words") }
    [blank, own].each { |g| g.meetings.new.apply_oiaa(OiaaMeeting.find_by!(slug: "cm1")).save! }
    travel 1.minute do
      OiaaFeed.sync!(feed.to_json)
    end
    assert_match(/\AWe are a zoom only meeting/, blank.reload.description)
    assert_equal "Our own words", own.reload.description
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

  test "imported text keeps its ampersands and quotes as characters" do
    assert_equal "Post & Wellesley", OiaaFeed.clean("Post & Wellesley")
    assert_equal "Post & Wellesley", OiaaFeed.clean("Post &amp; Wellesley")
    assert_equal "Post & Wellesley", OiaaFeed.clean("Post &amp;amp; Wellesley")
    assert_equal "Bill's <3 group", OiaaFeed.clean("<b>Bill&#39;s</b> &lt;3 group")
  end

  # e.g. chicagoaa.org's 12 Step Meeting List feed: Cloudflare answers servers with a
  # "Verify you are human" page (403, cf-mitigated: challenge) instead of the JSON
  test "a site's bot protection page says to import the feed as a file" do
    challenge = Net::HTTPForbidden.new("1.1", "403", "Forbidden")
    challenge["cf-mitigated"] = "challenge"
    challenge["content-type"] = "text/html; charset=UTF-8"
    challenge.instance_variable_set(:@read, true)
    challenge.instance_variable_set(:@body, "<title>Just a moment...</title><p>Performing security verification</p>")
    assert OiaaFeed.bot_challenge?(challenge)

    http = Struct.new(:response) { def request(_req) = response }.new(challenge)
    Net::HTTP.stub(:start, ->(*_args, **_opts, &blk) { blk.call(http) }) do
      error = assert_raises(OiaaFeed::Blocked) { OiaaFeed.fetch_feed("https://www.chicagoaa.org/wp-admin/admin-ajax.php?action=meetings") }
      assert_match(/\Achicagoaa\.org has bot protection/, error.message)
      assert_match "JSON or CSV file", error.message
    end

    # the same page with a 200 (some protections answer that way)
    OiaaFeed.stub(:get, "<html><script src=\"/cdn-cgi/challenge-platform/h/b/orchestrate\"></script></html>") do
      assert_raises(OiaaFeed::Blocked) { OiaaFeed.fetch_feed("https://example.org/feed") }
    end

    # a plain 403 or a real feed isn't mistaken for one
    forbidden = Net::HTTPForbidden.new("1.1", "403", "Forbidden")
    forbidden.instance_variable_set(:@read, true)
    forbidden.instance_variable_set(:@body, "Forbidden")
    assert_not OiaaFeed.bot_challenge?(forbidden)
    ok = Net::HTTPOK.new("1.1", "200", "OK")
    ok["content-type"] = "application/json"
    ok.instance_variable_set(:@read, true)
    ok.instance_variable_set(:@body, "[]")
    assert_not OiaaFeed.bot_challenge?(ok)
  end
end
