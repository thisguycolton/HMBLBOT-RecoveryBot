require "test_helper"

# Link previews (ShareMeta, application/_share_meta) and their pictures (ShareCard)
class SharePreviewsTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  IMESSAGE = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0"
  BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"

  setup do
    Rails.application.reload_routes_unless_loaded
    @user = User.create!(email: "lee@example.com", name: "Lee", password: "password123", confirmed: true)
    @group = Group.create!(title: "Sunrise Crew", description: "Early birds", time_zone: "America/Phoenix")
    @public = @group.documents.create!(title: "Our format", kind: "format", body: "<p>Welcome <strong>everyone</strong></p>", body_format: "html", visibility: "public")
    @members = @group.documents.create!(title: "Guidelines", kind: "guidelines", body: "Be kind", visibility: "members")
    @meeting = @group.meetings.create!(name: "Sunrise Crew", recurrence: "weekly", day_of_week: 1, start_minute: 420, end_minute: 480, time_zone: "America/Phoenix")
    @group.meetings.create!(name: "Sunrise Crew", recurrence: "weekly", day_of_week: 3, start_minute: 420, end_minute: 480, time_zone: "America/Phoenix")
    @event = @group.events.create!(title: "Potluck", status: "published", time_zone: "America/Phoenix", starts_at: 5.days.from_now, created_by: @user)
    @reading = Reading.create!(title: "Acceptance", source: "Big Book, p. 417", user: @user, group: @group, published_at: 1.hour.ago,
                               content: "<p>Secret text</p>", meetingDate: Date.current, meetingTime: "07:00")
  end

  def meta(property) = css_select("meta[property='#{property}'], meta[name='#{property}']").first&.[]("content")

  test "a group, its meeting and a Public document get their own preview" do
    get "/groups/#{@group.slug}"
    assert_equal "Sunrise Crew", meta("og:title")
    assert_equal "Early birds", meta("og:description")
    assert_match %r{/share_cards/group/#{@group.slug}\.png\?v=}, meta("og:image")
    assert_equal "summary_large_image", meta("twitter:card")

    get "/groups/#{@group.slug}/meetings/#{@meeting.id}"
    assert_response :success
    assert_match "Mon, Wed, 7:00 AM–8:00 AM", meta("og:description")
    assert_match %r{/share_cards/meeting/#{@meeting.id}\.png}, meta("og:image")

    get "/groups/#{@group.slug}/conscience/documents/#{@public.id}"
    assert_equal "Our format · Sunrise Crew", meta("og:title")
    assert_match "Welcome everyone", meta("og:description")

    # A Members document shows the group's preview, not its title
    get "/groups/#{@group.slug}/conscience/documents/#{@members.id}"
    assert_equal "Sunrise Crew", meta("og:title")
  end

  test "an event's preview has its name, date and group" do
    get "/events/#{@event.token}"
    assert_equal "Potluck · Sunrise Crew", meta("og:title")
    assert_match @event.starts_local.strftime("%b %-d, %Y"), meta("og:description")
    assert_match %r{/share_cards/event/#{@event.token}\.png}, meta("og:image")

    @event.update!(status: "draft")
    get "/events/#{@event.token}"
    assert_equal "RecoveryBot", meta("og:title")
  end

  test "link-preview fetchers get a reading's title and card, never its text; other robots still get 403" do
    get "/readings/#{@reading.id}", headers: { "User-Agent" => IMESSAGE, "Accept" => "*/*" }
    assert_response :success
    assert_equal "Acceptance · Sunrise Crew", meta("og:title")
    assert_no_match "Secret text", response.body
    assert_match "noindex", response.headers["X-Robots-Tag"]

    get "/readings/#{@reading.id}", headers: { "User-Agent" => "Mozilla/5.0 (compatible; GPTBot/1.2)" }
    assert_response :forbidden

    @reading.update!(published_at: nil)
    get "/readings/#{@reading.id}", headers: { "User-Agent" => IMESSAGE }
    assert_response :forbidden
  end

  test "people get the reading with its preview tags" do
    get "/readings/#{@reading.id}", headers: { "User-Agent" => BROWSER }
    assert_response :success
    assert_match "Secret text", response.body
    assert_match %r{/share_cards/reading/#{@reading.id}\.png}, meta("og:image")
  end

  test "cards are PNGs for things anyone may open, and 404 for the rest" do
    [["document", @public.id], ["group", @group.slug], ["event", @event.token], ["meeting", @meeting.id], ["reading", @reading.id], ["site", "recoverybot"]].each do |kind, id|
      get "/share_cards/#{kind}/#{id}.png", headers: { "User-Agent" => IMESSAGE }
      assert_response :success, kind
      assert_equal "image/png", response.media_type
      assert_equal "\x89PNG".b, response.body.b.first(4)
      assert_equal [1200, 630], response.body.b[16, 8].unpack("NN"), kind
    end

    get "/share_cards/document/#{@members.id}.png"
    assert_response :not_found
    @group.update!(status: "pending")
    get "/share_cards/group/#{@group.slug}.png"
    assert_response :not_found
  end

  test "ImageMagick gets text as text" do
    card = ShareCard.new(style: :page, title: "@/etc/passwd 100% \\n done", kicker: "%[pixel:p]")
    assert File.size(card.path).positive?
    assert_includes card.send(:caption, "@/etc/passwd 50%"), "caption:\\@/etc/passwd 50%%"
  end
end
