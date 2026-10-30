require "test_helper"

class Api::GroupChatTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  include ActionCable::TestHelper

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
end
