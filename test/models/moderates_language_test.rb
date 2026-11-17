require "test_helper"

class ModeratesLanguageTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    ENV["GROUPS_FOR_EVERYONE"] = "1"
    @ann = User.create!(email: "ann@example.com", name: "Ann A", password: "password123", confirmed: true)
    @group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    @group.memberships.create!(user: @ann, role: "admin")
  end

  teardown { ENV.delete("GROUPS_FOR_EVERYONE") }

  test "a slur can't be saved, on create or edit; swearing can" do
    channel = @group.general_channel
    message = channel.messages.new(user: @ann, body: "you n1gga")
    refute message.valid?
    assert_match(/slur/, message.errors[:body].first)

    message.body = "fuck yeah, shit happens"
    assert message.save

    message.body = "fine, wetback"
    refute message.save
    assert_equal "fuck yeah, shit happens", message.reload.body
  end

  test "profiles, groups and JSON blocks are checked" do
    @ann.bio = "proud k1ke hater"
    refute @ann.valid?
    assert @ann.errors[:bio].any?

    @ann.reload.name = "Spic Guy"
    refute @ann.valid?

    @group.description = "No spics"
    refute @group.valid?
  end

  test "only what changed is checked" do
    note = TimelineNote.create!(user: @ann, body: "hello", visibility: "private")
    note.update_column(:body, "old coon text")
    note.visibility = "public"
    assert note.valid?
  end

  test "the API says why instead of failing" do
    sign_in @ann
    channel = @group.general_channel
    post "/api/groups/#{@group.slug}/chat_channels/#{channel.id}/messages", params: { body: "n i g g e r" }, as: :json
    assert_response :unprocessable_entity
    assert_match(/slur/, response.parsed_body["error"])

    post "/api/groups/#{@group.slug}/chat_channels/#{channel.id}/messages", params: { body: "holy shit, 1 year!" }, as: :json
    assert_response :success
  end
end
