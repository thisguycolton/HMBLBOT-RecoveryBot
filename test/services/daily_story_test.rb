require "test_helper"
require "minitest/mock"

# The day's Daily Reflection posted as a Facebook (and Instagram) Story (DailyStory), and the
# Story clips it's made of (QuoteCard#story_clips)
class DailyStoryTest < ActiveSupport::TestCase
  self.fixture_table_names = []

  setup do
    @env = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @boss = User.create!(email: "boss@example.com", password: "password123", confirmed: true, name: "Boss", admin: true)
    book = Book.create!(title: "Daily Reflections", slug: "daily-reflections")
    @chapter = book.chapters.create!(title: "A New Way of Life", slug: "november-8", index: 1)
    @connection = FacebookPageConnection.current
    @connection.update!(page_id: "123", page_name: "RecoveryBot", page_token: "PAGE-TOKEN", enabled: true, post_at: "06:00", time_zone: "America/Phoenix")
    @at_six = Time.find_zone("America/Phoenix").local(2026, 11, 8, 6, 2)
  end

  teardown { ENV["ADMIN_EMAILS"] = @env }

  # Posts with the video and Facebook replaced: yields what was posted
  def posting(clips: ["/tmp/story-1.mp4"], facebook: nil, instagram: nil)
    posted = { facebook: [], instagram: [], looks: [] }
    facebook ||= ->(page, token, file) { posted[:facebook] << [page, token, file]; "123_#{posted[:facebook].size}" }
    instagram ||= ->(ig, _token, file) { posted[:instagram] << [ig, file]; "ig#{posted[:instagram].size}" }
    DailyStory.stub(:clips, ->(chapter, look:, dir:) { posted[:looks] << [chapter.slug, look]; clips }) do
      MetaGraph.stub(:post_page_story, facebook) do
        MetaGraph.stub(:post_instagram_story, instagram) { yield posted }
      end
    end
  end

  test "posts the day's reading once, at its time, in every clip" do
    posting(clips: %w[/tmp/story-1.mp4 /tmp/story-2.mp4]) do |posted|
      assert_nil DailyStory.post_due!(@at_six - 10.minutes), "not before its time"
      record = DailyStory.post_due!(@at_six)
      assert_equal ["posted", 2, "A New Way of Life", %w[123_1 123_2], "schedule"],
                   [record.status, record.clips, record.chapter_title, record.facebook_ids, record.triggered_by]
      assert_equal [["123", "PAGE-TOKEN", "/tmp/story-1.mp4"], ["123", "PAGE-TOKEN", "/tmp/story-2.mp4"]], posted[:facebook]
      assert_equal [["november-8", "night"]], posted[:looks]
      assert_empty posted[:instagram], "Instagram is off"
      assert_nil DailyStory.post_due!(@at_six + 5.minutes), "only once a day"
      assert_nil DailyStory.post_due!(@at_six + 4.hours), "and not hours late"
      assert_nil @connection.reload.posting_started_at
    end
  end

  test "nothing when it's turned off or not connected" do
    posting do |posted|
      @connection.update!(enabled: false)
      assert_nil DailyStory.post_due!(@at_six)
      @connection.update!(enabled: true, page_token: nil)
      assert_nil DailyStory.post_due!(@at_six)
      assert_empty posted[:facebook]
    end
  end

  test "Instagram too when it's linked and turned on; one failing is a partial post" do
    @connection.update!(instagram_id: "ig-9", instagram_username: "recoverybot", instagram_enabled: true)
    posting do |posted|
      assert_equal %w[ig1], DailyStory.post_due!(@at_six).instagram_ids
      assert_equal [["ig-9", "/tmp/story-1.mp4"]], posted[:instagram]
    end

    fail_ig = ->(*) { raise MetaGraph::Error, "Instagram couldn't use the video" }
    posting(instagram: fail_ig) do
      record = DailyStory.post!(@connection, on: @at_six.to_date, by: "admin", user: @boss)
      assert_equal "partial", record.status
      assert_match(/\AInstagram: Instagram couldn't use the video/, record.error)
    end
    assert_equal "Today's story only partly posted", Notification.where(user: @boss, kind: "daily_story.failed").last.title
  end

  test "a failed post is kept and the site admins hear about it" do
    expired = ->(*) { raise MetaGraph::Error.new("Error validating access token", code: 190) }
    posting(facebook: expired) do
      record = DailyStory.post_due!(@at_six)
      assert_equal "failed", record.status
      assert_match(/Connect it again in Site Admin > Daily story/, record.error)
    end
    note = Notification.find_by!(user: @boss, kind: "daily_story.failed")
    assert_equal ["Today's story didn't post", "/admin_panel/daily_story"], [note.title, note.url]
  end

  test "a day with no reading, or a members-only book, isn't posted" do
    posting do |posted|
      record = DailyStory.post!(@connection, on: Date.new(2026, 11, 9), by: "admin")
      assert_equal "failed", record.status
      assert_match(/no Daily Reflection for November 9/, record.error)

      @chapter.book.update!(members_only: true)
      assert_match(/members only/, DailyStory.post!(@connection, on: Date.new(2026, 11, 8), by: "admin").error)
      assert_empty posted[:facebook]
    end
  end

  test "two at once: the second waits its turn" do
    @connection.update_columns(posting_started_at: 1.minute.ago)
    posting { assert_nil DailyStory.post!(@connection, on: @at_six.to_date, by: "admin") }
    @connection.update_columns(posting_started_at: 2.hours.ago) # a server restart left it
    posting { assert_equal "posted", DailyStory.post!(@connection, on: @at_six.to_date, by: "admin").status }
  end

  test "next post time" do
    @connection.update!(posted_on: nil)
    assert_equal Time.find_zone("America/Phoenix").local(2026, 11, 8, 6, 0), @connection.next_post_at(@at_six - 1.hour)
    assert_equal Time.find_zone("America/Phoenix").local(2026, 11, 9, 6, 0), @connection.next_post_at(@at_six)
    @connection.update!(enabled: false)
    assert_nil @connection.next_post_at(@at_six)
  end

  test "the token is kept encrypted" do
    raw = FacebookPageConnection.connection.select_value("SELECT page_token FROM facebook_page_connections WHERE id = #{@connection.id}")
    assert_not_includes raw, "PAGE-TOKEN"
    assert_equal "PAGE-TOKEN", @connection.reload.page_token
  end

  # One real video: short words in one clip with a silent sound track; a lower limit cuts it
  # between pages
  test "story clips: Facebook-ready MP4s, cut to stay under the limit" do
    words = "We admitted we were powerless over alcohol, that our lives had become unmanageable. " * 14
    card = QuoteCard.new(kind: :reading, quote: words, source: "Daily Reflections", size: "story", video: true)
    assert_equal "fast", card.instance_variable_get(:@turn), "the fastest pace unless asked otherwise"
    Dir.mktmpdir do |dir|
      clips = card.story_clips(dir)
      assert_equal 1, clips.size
      info = `ffprobe -v error -show_entries stream=codec_name,width,height,sample_rate,channels -of compact #{clips.first}`
      assert_includes info, "codec_name=h264|width=1080|height=1920"
      assert_includes info, "codec_name=aac|sample_rate=48000|channels=2"
      whole = `ffprobe -v error -show_entries format=duration -of csv=p=0 #{clips.first}`.to_f
      assert whole.between?(3, QuoteCard::STORY_MAX)

      limit = QuoteCard::STORY_MAX
      silence_warnings { QuoteCard.const_set(:STORY_MAX, (whole / 2) + 1) }
      begin
        cut = QuoteCard.new(kind: :reading, quote: words, source: "Daily Reflections", size: "story", video: true).story_clips(File.join(dir, "cut").tap { |d| FileUtils.mkdir_p(d) })
        assert_operator cut.size, :>=, 2
        cut.each { |f| assert_operator `ffprobe -v error -show_entries format=duration -of csv=p=0 #{f}`.to_f, :<=, (whole / 2) + 1.1 }
      ensure
        silence_warnings { QuoteCard.const_set(:STORY_MAX, limit) }
      end
    end
  end
end
