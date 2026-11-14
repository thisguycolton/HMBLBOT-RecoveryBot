require "test_helper"
require "minitest/mock"

# Notifications in the iPhone and Android apps: the app's Firebase token (DeviceToken, posted to
# Api::PushSubscriptionsController#app_create) and FcmSender, which sends every Notification to it
class Api::AppPushTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  TOKEN = "fcm-token-abc:APA91b#{'x' * 120}".freeze
  KEY = OpenSSL::PKey::RSA.generate(2048)
  ACCOUNT = { type: "service_account", project_id: "recoverybot-test", client_email: "push@recoverybot-test.iam.gserviceaccount.com",
              private_key: KEY.to_pem }.to_json

  setup do
    Rails.application.reload_routes_unless_loaded
    @env = ENV.to_h.slice("FIREBASE_SERVICE_ACCOUNT", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY")
    %w[VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY].each { |k| ENV.delete(k) }
    ENV["FIREBASE_SERVICE_ACCOUNT"] = ACCOUNT
    @user = User.create!(email: "me@example.com", name: "Me", password: "password123", confirmed: true)
    sign_in @user
  end

  teardown do
    %w[FIREBASE_SERVICE_ACCOUNT VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY].each { |k| ENV.delete(k) }
    @env.each { |k, v| ENV[k] = v }
  end

  def register(token = TOKEN, platform: "ios")
    post "/api/push_subscriptions/app", params: { token: token, platform: platform, app_version: "1.0" }, as: :json
  end

  def response_for(code, body = "{}")
    klass = Net::HTTPResponse::CODE_TO_OBJ[code.to_s]
    klass.new("1.1", code.to_s, "").tap do |res|
      res.instance_variable_set(:@body, body)
      res.instance_variable_set(:@read, true)
    end
  end

  # Runs the block with Firebase answering `code`; returns what was sent
  def with_firebase(code = 200, body = "{}")
    sent = []
    post = lambda do |uri, data, headers|
      sent << { uri: uri.to_s, message: JSON.parse(data)["message"], auth: headers["Authorization"] }
      response_for(code, body)
    end
    FcmSender.stub(:access_token, "tok") do
      Net::HTTP.stub(:post, post) { yield }
    end
    sent
  end

  test "the app's token is saved once and listed as this phone; another account signing in takes it" do
    register
    assert_response :created
    body = response.parsed_body
    assert body["app_available"]
    device = body["devices"].sole
    assert_equal ["RecoveryBot app on iPhone", true, true], device.values_at("label", "app", "this_device")
    assert_match(/\Aapp-\d+\z/, device["id"])

    register
    assert_equal 1, DeviceToken.count
    get "/api/push_subscriptions?token=#{CGI.escape(TOKEN)}"
    assert response.parsed_body["devices"].sole["this_device"]
    get "/api/push_subscriptions"
    assert_not response.parsed_body["devices"].sole["this_device"]

    other = User.create!(email: "other@example.com", password: "password123", confirmed: true)
    sign_in other
    register(platform: "android")
    assert_equal [[other.id, "android"]], DeviceToken.pluck(:user_id, :platform)
    assert_equal "RecoveryBot app on Android", response.parsed_body["devices"].sole["label"]
  end

  test "nothing is saved until Firebase is set up, or for a made-up platform or no token" do
    ENV.delete("FIREBASE_SERVICE_ACCOUNT")
    get "/api/push_subscriptions"
    assert_equal false, response.parsed_body["app_available"]
    register
    assert_response :unprocessable_entity

    ENV["FIREBASE_SERVICE_ACCOUNT"] = Base64.strict_encode64(ACCOUNT) # pasted base64 works too
    register(platform: "windows")
    assert_response :unprocessable_entity
    register("")
    assert_response :unprocessable_entity
    assert_equal 0, DeviceToken.count

    sign_out @user
    register
    assert_response :unauthorized
  end

  test "turning off or logging out drops the token, signed in or not" do
    register
    sign_out @user
    delete "/api/push_subscriptions/app", params: { token: TOKEN }, as: :json
    assert_response :no_content
    assert_equal 0, DeviceToken.count
  end

  test "removing one of your app installs from settings, not someone else's" do
    register
    mine = DeviceToken.sole
    other = User.create!(email: "other@example.com", password: "password123", confirmed: true)
    theirs = other.device_tokens.create!(token: "theirs-token", platform: "android")

    delete "/api/push_subscriptions/app-#{theirs.id}"
    assert_response :not_found
    delete "/api/push_subscriptions/app-#{mine.id}?current_token=#{CGI.escape(TOKEN)}"
    assert_response :success
    assert_equal [], response.parsed_body["devices"]
    assert_equal [theirs.id], DeviceToken.pluck(:id)
  end

  test "new notifications go to the app through Firebase and open their page; a gone token is dropped" do
    register
    sent = with_firebase do
      perform_enqueued_jobs { Notification.deliver(@user, kind: "follow.created", title: "Sam followed you", body: "Say hi", url: "/people/sam") }
    end
    note = @user.notifications.sole
    req = sent.sole
    assert_equal "https://fcm.googleapis.com/v1/projects/recoverybot-test/messages:send", req[:uri]
    assert_equal "Bearer tok", req[:auth]
    assert_equal TOKEN, req[:message]["token"]
    assert_equal({ "title" => "Sam followed you", "body" => "Say hi" }, req[:message]["notification"])
    assert_equal "/notifications/#{note.id}/open", req[:message].dig("data", "url")
    assert_equal "n-#{note.id}", req[:message].dig("apns", "headers", "apns-collapse-id")
    assert DeviceToken.sole.last_sent_at.present?

    unregistered = { error: { code: 404, status: "NOT_FOUND", details: [{ "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError", errorCode: "UNREGISTERED" }] } }.to_json
    with_firebase(404, unregistered) do
      perform_enqueued_jobs { Notification.deliver(@user, kind: "follow.created", title: "Ana followed you") }
    end
    assert_equal 0, DeviceToken.count
  end

  test "a reminder goes to every app install on the account, as plain words, and a Site Admin can see where it went" do
    register
    register("#{TOKEN}-android", platform: "android")
    sent = with_firebase do
      perform_enqueued_jobs { Notification.deliver(@user, kind: "recovery.step_reminder", title: "Time for your **10th step**", body: "### **Android Users!!**  Test the [real app](https://x.test) now") }
    end
    assert_equal [TOKEN, "#{TOKEN}-android"].sort, sent.map { |r| r[:message]["token"] }.sort
    assert_equal({ "title" => "Time for your 10th step", "body" => "Android Users!! Test the real app now" }, sent.first[:message]["notification"])
    get "/api/notifications"
    assert_equal ["Time for your 10th step", "Android Users!! Test the real app now"], response.parsed_body["notifications"].sole.values_at("title", "body")

    admin = User.create!(email: "boss@example.com", name: "Boss", password: "password123", confirmed: true, admin: true)
    get "/api/admin/users/#{@user.id}/notifications"
    assert_response :forbidden
    sign_in admin
    old = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = admin.email
    get "/api/admin/users/#{@user.id}/notifications"
    assert_response :success
    info = response.parsed_body
    assert_equal ["RecoveryBot app on Android", "RecoveryBot app on iPhone"], info["apps"].map { |d| d["label"] }.sort
    assert(info["apps"].all? { |d| d["last_sent_at"].present? })
    assert info["reminders_pushed"]
    assert_equal "Time for your 10th step", info["recent"].sole["title"]
  ensure
    ENV["ADMIN_EMAILS"] = old if admin
  end

  test "Firebase having a bad moment keeps the token" do
    register
    with_firebase(503, { error: { code: 503, status: "UNAVAILABLE" } }.to_json) do
      perform_enqueued_jobs { Notification.deliver(@user, kind: "follow.created", title: "Sam followed you") }
    end
    assert_equal 1, DeviceToken.count
  end

  test "kinds turned off aren't sent to the app either, and nothing goes out without Firebase" do
    register
    patch "/api/push_subscriptions/categories", params: { key: "reactions", on: false }, as: :json
    sent = with_firebase do
      perform_enqueued_jobs do
        Notification.deliver(@user, kind: "note.reaction", title: "Sam liked your note")
        Notification.deliver(@user, kind: "meeting_host.sub_needed", title: "Can you cover Friday?")
      end
    end
    assert_equal ["Can you cover Friday?"], sent.map { _1[:message].dig("notification", "title") }

    ENV.delete("FIREBASE_SERVICE_ACCOUNT")
    assert_no_enqueued_jobs(only: WebPushJob) { Notification.deliver(@user, kind: "x", title: "Hi") }
  end

  test "a test notification to this phone" do
    register
    sent = with_firebase { post "/api/push_subscriptions/test", params: { token: TOKEN }, as: :json }
    assert_response :no_content
    assert_equal Api::PushSubscriptionsController::TEST_TITLE, sent.sole[:message].dig("notification", "title")

    with_firebase(500) { post "/api/push_subscriptions/test", params: { token: TOKEN }, as: :json }
    assert_response :bad_gateway
    post "/api/push_subscriptions/test", params: { token: "someone-elses" }, as: :json
    assert_response :not_found
  end

  test "deleting the account deletes its app tokens" do
    register
    @user.destroy
    assert_equal 0, DeviceToken.count
  end
end
