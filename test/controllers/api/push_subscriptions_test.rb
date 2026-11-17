require "test_helper"
require "minitest/mock"

class Api::PushSubscriptionsTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123".freeze
  KEYS = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" }.freeze

  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV.to_h.slice("VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY")
    key = WebPush.generate_key
    ENV["VAPID_PUBLIC_KEY"] = key.public_key
    ENV["VAPID_PRIVATE_KEY"] = key.private_key
    @user = User.create!(email: "me@example.com", name: "Me", password: "password123", confirmed: true)
    sign_in @user
  end

  teardown do
    %w[VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY].each { |k| ENV.delete(k) }
    @env.each { |k, v| ENV[k] = v }
  end

  def subscribe(endpoint = ENDPOINT, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")
    post "/api/push_subscriptions", params: { subscription: { endpoint: endpoint, keys: KEYS } }, headers: { "User-Agent" => ua }, as: :json
  end

  test "the public key and this device's state" do
    get "/api/push_subscriptions"
    assert_response :success
    assert_equal [true, ENV["VAPID_PUBLIC_KEY"], []], response.parsed_body.values_at("available", "public_key", "devices")

    ENV.delete("VAPID_PRIVATE_KEY")
    get "/api/push_subscriptions"
    assert_equal false, response.parsed_body["available"]
    subscribe
    assert_response :unprocessable_entity
  end

  test "a device subscribes once, and another account signing in on it takes it over" do
    subscribe
    assert_response :created
    device = response.parsed_body["devices"].sole
    assert_equal ["Safari on iPhone", true], device.values_at("label", "this_device")

    subscribe
    assert_equal 1, PushSubscription.count

    other = User.create!(email: "other@example.com", password: "password123", confirmed: true)
    sign_in other
    subscribe
    assert_equal [other.id], PushSubscription.pluck(:user_id)
  end

  test "only real push services, so the server can't be pointed elsewhere" do
    ["http://fcm.googleapis.com/x", "https://169.254.169.254/latest", "https://evil.example.com/fcm.googleapis.com", "https://fcm.googleapis.com.evil.com/x",
     "https://user@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x"].each do |bad|
      subscribe(bad)
      assert_response :unprocessable_entity, bad
    end
    %w[https://web.push.apple.com/QGx https://updates.push.services.mozilla.com/wpush/v2/x https://wns2-par02p.notify.windows.com/w/?token=x].each do |good|
      subscribe(good)
      assert_response :created, good
    end
  end

  test "turning off by endpoint works signed out too (after signing out on that device)" do
    subscribe
    sign_out @user
    delete "/api/push_subscriptions", params: { endpoint: ENDPOINT }, as: :json
    assert_response :no_content
    assert_equal 0, PushSubscription.count
  end

  test "removing another of your devices, not someone else's" do
    subscribe
    mine = PushSubscription.sole
    other = User.create!(email: "other@example.com", password: "password123", confirmed: true)
    theirs = other.push_subscriptions.create!(endpoint: "https://web.push.apple.com/other", **KEYS)

    delete "/api/push_subscriptions/#{theirs.id}"
    assert_response :not_found
    delete "/api/push_subscriptions/#{mine.id}"
    assert_response :success
    assert_equal [theirs.id], PushSubscription.pluck(:id)
  end

  test "new notifications are pushed to the account's devices; gone ones are dropped" do
    subscribe
    sent = []
    fake = ->(**args) { sent << args; true }
    WebPush.stub(:payload_send, fake) do
      perform_enqueued_jobs do
        Notification.deliver(@user, kind: "follow.created", title: "Sam followed you", url: "/people/sam")
      end
    end
    msg = JSON.parse(sent.sole[:message])
    note = @user.notifications.sole
    assert_equal ["Sam followed you", "/notifications/#{note.id}/open", 1], msg.values_at("title", "url", "unread")
    assert_equal ENDPOINT, sent.sole[:endpoint]
    assert PushSubscription.sole.last_sent_at.present?

    gone = ->(**) { raise WebPush::ExpiredSubscription.new(Struct.new(:body, :code).new("", "410"), "fcm.googleapis.com") }
    WebPush.stub(:payload_send, gone) do
      perform_enqueued_jobs { Notification.deliver(@user, kind: "follow.created", title: "Ana followed you") }
    end
    assert_equal 0, PushSubscription.count
  end

  test "kinds turned off aren't pushed but still show in the bell" do
    subscribe
    get "/api/push_subscriptions"
    keys = response.parsed_body["categories"].map { _1["key"] }
    assert_includes keys, "reactions"
    assert_not_includes keys, "site_admin"
    assert response.parsed_body["categories"].all? { _1["on"] }

    patch "/api/push_subscriptions/categories", params: { key: "reactions", on: false }, as: :json
    assert_response :success
    assert_equal false, response.parsed_body["categories"].find { _1["key"] == "reactions" }["on"]
    assert_equal ["reactions"], @user.reload.push_off

    sent = []
    WebPush.stub(:payload_send, ->(**args) { sent << args; true }) do
      perform_enqueued_jobs do
        Notification.deliver(@user, kind: "note.reaction", title: "Sam liked your note")
        Notification.deliver(@user, kind: "meeting_host.sub_needed", title: "Can you cover Friday?")
        Notification.deliver(@user, kind: "user.approved", title: "Welcome")
      end
    end
    assert_equal ["Can you cover Friday?", "Welcome"], sent.map { JSON.parse(_1[:message])["title"] }
    assert_equal 3, @user.notifications.count

    patch "/api/push_subscriptions/categories", params: { key: "reactions", on: true }, as: :json
    assert_equal [], @user.reload.push_off
    patch "/api/push_subscriptions/categories", params: { key: "site_admin", on: false }, as: :json
    assert_response :unprocessable_entity
    patch "/api/push_subscriptions/categories", params: { key: "nope", on: false }, as: :json
    assert_response :unprocessable_entity
  end

  test "every kind of notification the app sends is in a push category or deliberately always pushed" do
    always = %w[user.approved text_report.resolved]
    kinds = Dir[Rails.root.join("app/**/*.rb")].flat_map { File.read(_1).scan(/kind: "([a-z_]+\.[a-z_]+)"/).flatten }.uniq
    kinds += %w[note.reaction comment.reaction schedule_poll.invitee schedule_poll.collaborator] # built from variables
    kinds.reject! { _1.start_with?("schedule_poll.#") }
    assert_empty kinds - Notification::PUSH_CATEGORY_BY_KIND.keys - always
  end

  test "no devices or no keys, no push job" do
    assert_no_enqueued_jobs(only: WebPushJob) { Notification.deliver(@user, kind: "x", title: "Hi") }
    subscribe
    ENV.delete("VAPID_PRIVATE_KEY")
    assert_no_enqueued_jobs(only: WebPushJob) { Notification.deliver(@user, kind: "x", title: "Hi") }
  end

  test "a test push to this device" do
    subscribe
    WebPush.stub(:payload_send, ->(**) { true }) do
      post "/api/push_subscriptions/test", params: { endpoint: ENDPOINT }, as: :json
    end
    assert_response :no_content
  end

  test "the service worker renews a subscription with the old endpoint, no sign-in needed" do
    subscribe
    sign_out @user
    post "/api/push_subscriptions/renew", params: { old_endpoint: ENDPOINT, subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/new", keys: KEYS } }, as: :json
    assert_response :no_content
    assert_equal "https://fcm.googleapis.com/fcm/send/new", PushSubscription.sole.endpoint

    post "/api/push_subscriptions/renew", params: { old_endpoint: "https://fcm.googleapis.com/nope", subscription: { endpoint: "https://fcm.googleapis.com/x", keys: KEYS } }, as: :json
    assert_response :not_found
  end

  test "tapping a pushed notification marks it read and opens its page, only on this site" do
    Notification.deliver(@user, kind: "x", title: "Hi", url: "/groups/acid-test")
    Notification.deliver(@user, kind: "x", title: "Hi", url: "//evil.example.com")
    first, second = @user.notifications.order(:id).to_a
    get "/notifications/#{first.id}/open"
    assert_redirected_to "/groups/acid-test"
    assert first.reload.read?
    get "/notifications/#{second.id}/open"
    assert_redirected_to "/"
  end

  test "the service worker, manifest and install page" do
    get "/service-worker.js"
    assert_response :success
    assert_includes response.body, "showNotification"
    get "/manifest.json"
    assert_equal "standalone", response.parsed_body["display"]
    get "/install"
    assert_response :success
    assert_equal({ "push" => true }, JSON.parse(Nokogiri::HTML(response.body).at("#site-page")["data-props"]))
  end

  test "deleting the account deletes its devices" do
    subscribe
    @user.destroy!
    assert_equal 0, PushSubscription.count
  end

  # A session running out keeps the device's notifications; logging out drops them (lib/push.js)
  test "logging out tells the next page to forget this browser's subscription" do
    subscribe
    get "/"
    assert_nil cookies["forget_push"]
    get "/users/sign_out"
    assert_equal "1", cookies["forget_push"]
    assert_equal 1, PushSubscription.count
  end
end
