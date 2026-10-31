require "test_helper"
require "minitest/mock"

class Api::GroupChatTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  include ActionCable::TestHelper
  include ActiveJob::TestHelper

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @ann = User.create!(email: "ann@example.com", name: "Ann A", password: "password123", confirmed: true)
    @bo = User.create!(email: "bo@example.com", name: "Bo B", password: "password123", confirmed: true)
    @cy = User.create!(email: "cy@example.com", name: "Cy C", password: "password123", confirmed: true)
    @out = User.create!(email: "out@example.com", name: "Out O", password: "password123", confirmed: true)
    @group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    @group.memberships.create!(user: @ann, role: "admin")
    @group.memberships.create!(user: @bo, role: "member", can_host: true)
    @group.memberships.create!(user: @cy, role: "member")
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  def chat_path = "/api/groups/#{@group.slug}/chat"

  test "members get #general; others can't see the chat" do
    sign_in @out
    get chat_path
    assert_response :forbidden

    sign_in @cy
    get chat_path
    assert_response :success
    body = response.parsed_body
    assert_equal ["general"], body["channels"].map { _1["name"] }
    refute body["can_create"]
    refute body["can_manage"]
    assert_nil body["settings"]
  end

  test "posting, reading, editing and deleting messages, live" do
    general = @group.general_channel
    sign_in @bo
    assert_broadcasts(general.stream, 1) do
      post "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages", params: { body: "Hi **all**" }, as: :json
    end
    assert_response :created
    message = response.parsed_body
    assert message["mine"]

    sign_in @cy
    get chat_path
    assert_equal 1, response.parsed_body["channels"].first["unread"]
    get "/api/nav"
    assert_equal 1, response.parsed_body["groups"].first["chat_unread"]
    get "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages"
    assert_equal ["Hi **all**"], response.parsed_body["messages"].map { _1["body"] }
    post "/api/groups/#{@group.slug}/chat_channels/#{general.id}/read", params: { message_id: message["id"] }, as: :json
    get chat_path
    assert_equal 0, response.parsed_body["channels"].first["unread"]

    patch "/api/groups/#{@group.slug}/chat_messages/#{message['id']}", params: { body: "Changed" }, as: :json
    assert_response :forbidden
    delete "/api/groups/#{@group.slug}/chat_messages/#{message['id']}"
    assert_response :forbidden

    sign_in @bo
    patch "/api/groups/#{@group.slug}/chat_messages/#{message['id']}", params: { body: "Hi everyone" }, as: :json
    assert response.parsed_body["edited"]

    sign_in @ann
    assert_broadcasts(general.stream, 1) { delete "/api/groups/#{@group.slug}/chat_messages/#{message['id']}" }
    assert_response :no_content
  end

  test "admins pick who adds channels, and channels can be limited to roles and people" do
    sign_in @bo
    post "/api/groups/#{@group.slug}/chat_channels", params: { name: "hosts" }, as: :json
    assert_response :forbidden

    sign_in @ann
    patch chat_path, params: { creator_roles: ["hosts", "nope"], creator_user_ids: [@cy.id, @out.id] }, as: :json
    assert_equal({ "creator_roles" => ["hosts"], "creator_user_ids" => [@cy.id] }, response.parsed_body["settings"])

    sign_in @bo
    post "/api/groups/#{@group.slug}/chat_channels", params: { name: "Host Talk!", access_roles: ["hosts"] }, as: :json
    assert_response :created
    channel = ChatChannel.find(response.parsed_body["id"])
    assert_equal "host-talk", channel.name

    sign_in @cy
    get chat_path
    assert_equal ["general"], response.parsed_body["channels"].map { _1["name"] }, "Cy can't host"
    get "/api/groups/#{@group.slug}/chat_channels/#{channel.id}/messages"
    assert_response :not_found
    # Cy can add channels; one of only their own picks still lets them in
    post "/api/groups/#{@group.slug}/chat_channels", params: { name: "secret", access_roles: ["treasurers"] }, as: :json
    assert_includes ChatChannel.find(response.parsed_body["id"]).access_user_ids, @cy.id

    sign_in @bo
    patch "/api/groups/#{@group.slug}/chat_channels/#{channel.id}", params: { access_roles: [], access_user_ids: [@cy.id] }, as: :json
    assert_response :success
    sign_in @cy
    get chat_path
    assert_includes response.parsed_body["channels"].map { _1["name"] }, "host-talk"

    general = @group.general_channel
    sign_in @ann
    patch "/api/groups/#{@group.slug}/chat_channels/#{general.id}", params: { access_roles: ["hosts"] }, as: :json
    assert_response :unprocessable_entity
    delete "/api/groups/#{@group.slug}/chat_channels/#{general.id}"
    assert_response :unprocessable_entity
    delete "/api/groups/#{@group.slug}/chat_channels/#{channel.id}"
    assert_response :no_content
  end

  test "mentions alert people and role holders who are in the channel, once" do
    general = @group.general_channel
    pos = @group.service_positions.create!(title: "Secretary")
    pos.terms.create!(user: @cy, starts_on: Date.current - 30)
    sign_in @bo
    assert_difference -> { Notification.where(kind: "mention.chat").count }, 2 do
      post "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages",
           params: { body: "@ann-a and @secretary, also me@#{@cy.username}.com and `@#{@out.username}` and @everyone" }, as: :json
    end
    assert_equal "Bo B mentioned you in #general", @ann.notifications.last.title
    assert_equal "Bo B mentioned @secretary in #general", @cy.notifications.last.title
    message = ChatMessage.last
    assert_equal %w[secretary ann-a].sort, message.mentions.keys.sort, "@everyone is for admins"
    assert_equal "person", message.mentions["ann-a"]["type"]

    assert_no_difference -> { Notification.count } do
      patch "/api/groups/#{@group.slug}/chat_messages/#{message.id}", params: { body: "@ann-a @secretary again" }, as: :json
    end

    hosts = @group.chat_channels.create!(name: "hosts", access_roles: ["hosts"])
    sign_in @ann
    assert_difference -> { Notification.where(kind: "mention.chat").count }, 1 do
      post "/api/groups/#{@group.slug}/chat_channels/#{hosts.id}/messages", params: { body: "@everyone and @#{@cy.username}" }, as: :json
    end
    assert_equal @bo, Notification.last.user, "Cy isn't in #hosts"
    assert_equal "Ann A mentioned @everyone in #hosts", Notification.last.title
    assert_includes Notification::PUSH_CATEGORIES["mentions"][:kinds], "mention.chat"
  end

  test "what @ suggests in a channel" do
    general = @group.general_channel
    sign_in @ann
    get "/api/mentions", params: { q: "b", group: @group.slug, channel: general.id }
    assert_equal ["bo-b"], response.parsed_body["people"].map { _1["username"] }
    get "/api/mentions", params: { q: "ho", group: @group.slug, channel: general.id }
    assert_equal %w[hosts coordinators], response.parsed_body["roles"].map { _1["handle"] }, "by handle or label"
    get "/api/mentions", params: { q: "ev", group: @group.slug, channel: general.id }
    assert_equal ["everyone"], response.parsed_body["roles"].map { _1["handle"] }
    sign_in @cy
    get "/api/mentions", params: { q: "ev", group: @group.slug, channel: general.id }
    assert_empty response.parsed_body["roles"]
    sign_in @out
    get "/api/mentions", params: { q: "", group: @group.slug, channel: general.id }
    assert_response :not_found
  end

  test "blocking someone takes them out and keeps them out until unblocked" do
    sign_in @bo
    post "/api/groups/#{@group.slug}/blocks", params: { user_id: @cy.id }, as: :json
    assert_response :forbidden

    sign_in @ann
    post "/api/groups/#{@group.slug}/blocks", params: { user_id: @cy.id }, as: :json
    assert_response :created
    refute @group.member?(@cy)
    get "/api/groups/#{@group.slug}"
    assert_equal [@cy.id], response.parsed_body["blocked"].map { _1["id"] }
    post "/api/groups/#{@group.slug}/memberships", params: { email: @cy.email }, as: :json
    assert_response :unprocessable_entity

    sign_in @cy
    post "/api/groups/#{@group.slug}/join"
    assert_response :forbidden
    post "/api/groups/join_with_token", params: { token: @group.join_token }, as: :json
    assert_response :forbidden

    sign_in @ann
    delete "/api/groups/#{@group.slug}/blocks/#{@cy.id}"
    sign_in @cy
    post "/api/groups/#{@group.slug}/join"
    assert_response :success
  end

  test "reporting a message to the site admins keeps a copy of it" do
    general = @group.general_channel
    message = general.messages.create!(user: @bo, body: "Something awful")
    sign_in @out
    post "/api/user_reports", params: { subject_type: "chat_message", subject_id: message.id, reason: "Mean" }, as: :json
    assert_response :not_found

    sign_in @cy
    assert_difference -> { UserReport.count }, 1 do
      post "/api/user_reports", params: { subject_type: "chat_message", subject_id: message.id, reason: "Mean" }, as: :json
    end
    report = UserReport.last
    assert_equal [@bo, @group, "Something awful", "#general in Acid Test"], [report.user, report.group, report.quote, report.where_label]
    message.destroy!
    assert_equal "Something awful", report.reload.quote
    post "/api/user_reports", params: { subject_type: "chat_message", subject_id: 0, reason: "x" }, as: :json
    assert_response :not_found
  end

  test "admins put the channels in order for everyone" do
    general = @group.general_channel
    a = @group.chat_channels.create!(name: "alpha", access_roles: ["members"])
    b = @group.chat_channels.create!(name: "beta", access_roles: ["members"])
    sign_in @cy
    patch "#{chat_path}/order", params: { channel_ids: [b.id, general.id, a.id] }, as: :json
    assert_response :forbidden

    sign_in @ann
    assert_broadcasts(GroupChatChannel.group_stream(@group), 1) do
      patch "#{chat_path}/order", params: { channel_ids: [b.id, general.id] }, as: :json
    end
    assert_response :success
    assert_equal %w[beta general alpha], response.parsed_body["channels"].map { _1["name"] }, "any left out go after"
    sign_in @cy
    get chat_path
    assert_equal %w[beta general alpha], response.parsed_body["channels"].map { _1["name"] }
  end

  test "anyone in a channel puts emoji on a message, each once, live" do
    general = @group.general_channel
    message = general.messages.create!(user: @bo, body: "Day 30 today")
    path = "/api/groups/#{@group.slug}/chat_messages/#{message.id}/reactions"
    sign_in @out
    post path, params: { emoji: "🎉" }, as: :json
    assert_response :not_found

    sign_in @cy
    assert_broadcasts(general.stream, 1) { post path, params: { emoji: "🎉" }, as: :json }
    assert_response :success
    post path, params: { emoji: "🎉" }, as: :json
    post path, params: { emoji: "❤️" }, as: :json
    post path, params: { emoji: "hello" }, as: :json
    assert_response :unprocessable_entity
    sign_in @ann
    post path, params: { emoji: "🎉" }, as: :json
    assert_equal [["🎉", 2, true, ["Cy C", "You"]], ["❤️", 1, false, ["Cy C"]]], response.parsed_body["reactions"].map { _1.values_at("emoji", "count", "mine", "names") }

    # Someone the viewer blocked still counts, without their name
    sign_in @bo
    post "/api/people/#{@cy.username}/block", as: :json
    assert_response :success
    get "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages"
    assert_equal [["🎉", 2, ["Ann A"]], ["❤️", 1, []]], response.parsed_body["messages"].first["reactions"].map { _1.values_at("emoji", "count", "names") }

    sign_in @cy
    delete "#{path}?emoji=#{CGI.escape('🎉')}"
    assert_response :success
    # (in the order the ones still on went on)
    assert_equal [["❤️", 1, true], ["🎉", 1, false]], response.parsed_body["reactions"].map { _1.values_at("emoji", "count", "mine") }

    general.update_column(:archived, true)
    post path, params: { emoji: "👍" }, as: :json
    assert_response :unprocessable_entity
  end

  test "replying to a message quotes it and tells its writer, if they can see the channel" do
    general = @group.general_channel
    first = general.messages.create!(user: @cy, body: "Anyone have a ride\nto the meeting?")
    path = "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages"
    sign_in @bo
    assert_difference -> { Notification.where(kind: "reply.chat").count }, 1 do
      post path, params: { body: "I can!", reply_to_id: first.id }, as: :json
    end
    assert_response :created
    reply = response.parsed_body["reply_to"]
    assert_equal [first.id, "Cy C", "Anyone have a ride to the meeting?"], [reply["id"], reply["author"]["name"], reply["excerpt"]]
    assert_equal "Bo B replied to you in #general", @cy.notifications.last.title
    assert_includes Notification::PUSH_CATEGORIES["mentions"][:kinds], "reply.chat"

    # Mentioned as well: one notification, the mention. Replying to yourself: none.
    assert_difference -> { @cy.notifications.count }, 1 do
      post path, params: { body: "@#{@cy.username} see above", reply_to_id: first.id }, as: :json
    end
    assert_equal "mention.chat", @cy.notifications.last.kind
    mine = ChatMessage.last
    assert_no_difference -> { Notification.count } do
      post path, params: { body: "and me", reply_to_id: mine.id }, as: :json
    end

    # Only to a message in the same channel
    other = @group.chat_channels.create!(name: "other", access_roles: ["members"])
    elsewhere = other.messages.create!(user: @cy, body: "Over here")
    post path, params: { body: "Hm", reply_to_id: elsewhere.id }, as: :json
    assert_response :unprocessable_entity

    # The one it answered gone: the reply says so
    first.destroy!
    get path
    assert_equal({ "id" => first.id, "gone" => true }, response.parsed_body["messages"].find { _1["body"] == "I can!" }["reply_to"])
  end

  test "admins and whoever added a channel pin messages there; everyone sees the pins" do
    general = @group.general_channel
    message = general.messages.create!(user: @cy, body: "Meeting moved to 7pm")
    pin = "/api/groups/#{@group.slug}/chat_messages/#{message.id}/pin"
    sign_in @cy
    post pin, as: :json
    assert_response :forbidden

    sign_in @ann
    assert_broadcasts(general.stream, 1) { post pin, as: :json }
    assert_response :success
    assert_equal "Ann A", response.parsed_body["pinned"]["by"]

    sign_in @cy
    get "/api/groups/#{@group.slug}/chat_channels/#{general.id}/pins"
    assert_equal [message.id], response.parsed_body["messages"].map { _1["id"] }
    refute response.parsed_body["messages"].first["can_pin"]

    mine = @group.chat_channels.create!(name: "cy-stuff", access_roles: ["members"], created_by: @cy)
    m2 = mine.messages.create!(user: @bo, body: "Pin me")
    post "/api/groups/#{@group.slug}/chat_messages/#{m2.id}/pin", as: :json
    assert_response :success, "whoever added the channel pins in it"

    sign_in @ann
    delete pin
    assert_response :success
    assert_nil response.parsed_body["pinned"]
    get "/api/groups/#{@group.slug}/chat_channels/#{general.id}/pins"
    assert_empty response.parsed_body["messages"]
  end

  test "admins move a message and its replies to another channel" do
    general = @group.general_channel
    hosts = @group.chat_channels.create!(name: "hosts", access_roles: ["hosts"])
    archived = @group.chat_channels.create!(name: "old", access_roles: ["members"], archived: true)
    wrong = general.messages.create!(user: @bo, body: "Who's covering Tuesday?")
    stays = general.messages.create!(user: @cy, body: "Unrelated")
    reply = general.messages.create!(user: @ann, body: "I am", reply_to: wrong)
    deeper = general.messages.create!(user: @bo, body: "Thanks", reply_to: reply)
    @group.chat_channels.where(id: general.id).update_all(last_message_at: 1.minute.ago)
    path = "/api/groups/#{@group.slug}/chat_messages/#{wrong.id}/move"

    sign_in @bo
    post path, params: { channel_id: hosts.id }, as: :json
    assert_response :forbidden

    sign_in @ann
    post path, params: { channel_id: archived.id }, as: :json
    assert_response :unprocessable_entity
    post path, params: { channel_id: general.id }, as: :json
    assert_response :unprocessable_entity
    assert_broadcasts(general.stream, 3) do
      assert_broadcasts(hosts.stream, 3) { post path, params: { channel_id: hosts.id }, as: :json }
    end
    assert_response :success
    assert_equal [3, hosts.id, "general"], [response.parsed_body["moved"], response.parsed_body["channel_id"], response.parsed_body["moved_from"]["name"]]
    assert_equal [hosts.id] * 3, [wrong, reply, deeper].map { _1.reload.chat_channel_id }
    assert_equal general.id, stays.reload.chat_channel_id
    assert_equal deeper.created_at.to_i, hosts.reload.last_message_at.to_i

    # Cy isn't in #hosts, so it's gone for them
    sign_in @cy
    get "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages"
    assert_equal ["Unrelated"], response.parsed_body["messages"].map { _1["body"] }
    get "/api/groups/#{@group.slug}/chat_messages/#{wrong.id}"
    assert_response :not_found
  end

  test "opening on an older message loads from just before it to the newest" do
    general = @group.general_channel
    messages = Array.new(80) { |i| general.messages.create!(user: @bo, body: "Message #{i}") }
    sign_in @cy
    get "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages", params: { from: messages[20].id }
    body = response.parsed_body
    assert_equal messages[10].id, body["messages"].first["id"]
    assert_equal messages.last.id, body["messages"].last["id"]
    assert body["more"]
    get "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages", params: { from: messages[3].id }
    assert_equal messages.first.id, response.parsed_body["messages"].first["id"]
    refute response.parsed_body["more"]
  end

  test "pictures and files go with a message, and only people in the channel get them" do
    hosts = @group.chat_channels.create!(name: "hosts", access_roles: ["hosts"])
    path = "/api/groups/#{@group.slug}/chat_channels/#{hosts.id}/messages"
    picture = Rack::Test::UploadedFile.new(file_fixture("avatar.png"), "image/png")
    pdf = Rack::Test::UploadedFile.new(StringIO.new("%PDF-1.4 minutes"), "application/pdf", original_filename: "Minutes.pdf")
    sign_in @bo
    post path, params: { body: "", files: [picture, pdf] }
    assert_response :created
    files = response.parsed_body["files"]
    assert_equal [["avatar.png", true], ["Minutes.pdf", false]], files.map { _1.values_at("name", "image") }

    get files.last["url"]
    assert_response :redirect

    exe = Rack::Test::UploadedFile.new(StringIO.new("MZ"), "application/octet-stream", original_filename: "run.exe")
    post path, params: { body: "hi", files: [exe] }
    assert_response :unprocessable_entity
    assert_match "run.exe can't be sent here", response.parsed_body["error"]
    post path, params: { body: "  " }
    assert_response :unprocessable_entity

    # Cy isn't in #hosts
    sign_in @cy
    get files.first["url"]
    assert_response :not_found

    # A reply to a picture says so
    sign_in @ann
    post path, params: { body: "Nice", reply_to_id: ChatMessage.last.id }, as: :json
    assert_equal "📎 2 files", response.parsed_body["reply_to"]["excerpt"]
  end

  test "a message's first link gets a card, read in the background; its writer can take it off" do
    general = @group.general_channel
    preview = { url: "https://example.org/step-one", title: "Step One", description: "We admitted we were powerless", site_name: "example.org", image_url: nil }
    sign_in @bo
    LinkPreview.stub(:fetch, preview) do
      perform_enqueued_jobs do
        assert_broadcasts(general.stream, 2) do
          post "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages", params: { body: "Read https://example.org/step-one." }, as: :json
        end
      end
    end
    message = ChatMessage.last
    get "/api/groups/#{@group.slug}/chat_messages/#{message.id}"
    assert_equal ["Step One", "https://example.org/step-one"], response.parsed_body["link"].values_at("title", "url")

    sign_in @cy
    delete "/api/groups/#{@group.slug}/chat_messages/#{message.id}/link"
    assert_response :forbidden
    sign_in @bo
    delete "/api/groups/#{@group.slug}/chat_messages/#{message.id}/link"
    assert_nil response.parsed_body["link"]
    refute message.reload.link_outdated?, "an edit that keeps the link doesn't bring the card back"

    # No link, no card
    assert_no_enqueued_jobs(only: ChatLinkPreviewJob) do
      post "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages", params: { body: "No links here" }, as: :json
    end
  end

  test "attaching the group's documents: only ones the writer can open, and each reader sees theirs" do
    general = @group.general_channel
    guidelines = @group.documents.create!(title: "Guidelines", kind: "guidelines", body: "Be kind", visibility: "members", status: "current")
    treasury = @group.documents.create!(title: "Treasurer notes", kind: "treasury", body: "Reserve", visibility: "keepers", status: "current")
    treasury.file.attach(io: StringIO.new("%PDF-1.4"), filename: "October.pdf", content_type: "application/pdf")
    path = "/api/groups/#{@group.slug}/chat_channels/#{general.id}/messages"

    sign_in @cy
    post path, params: { body: "", document_ids: [treasury.id] }, as: :json
    assert_response :unprocessable_entity, "Cy can't open the treasurer's notes"

    sign_in @ann
    post path, params: { body: "", document_ids: [treasury.id, guidelines.id] }, as: :json
    assert_response :created
    docs = response.parsed_body["documents"]
    assert_equal [["Treasurer notes", "October.pdf"], ["Guidelines", nil]], docs.map { [_1["title"], _1.dig("file", "name")] }
    assert_equal "/groups/#{@group.slug}/conscience/documents/#{guidelines.id}", docs.last["url"]

    sign_in @cy
    get path
    seen = response.parsed_body["messages"].last["documents"]
    assert_equal [{ "id" => treasury.id, "hidden" => true }, guidelines.id], [seen.first, seen.last["id"]]
  end
end
