require "test_helper"

class GroupChatChannelTest < ActionCable::Channel::TestCase
  self.fixture_table_names = []

  setup do
    @ann = User.create!(email: "ann@example.com", name: "Ann", password: "password123", confirmed: true)
    @bo = User.create!(email: "bo@example.com", name: "Bo", password: "password123", confirmed: true)
    @group = Group.create!(title: "Acid Test", time_zone: "America/Chicago")
    @group.memberships.create!(user: @ann, role: "member", can_host: true)
    @general = @group.general_channel
    @hosts = @group.chat_channels.create!(name: "hosts", access_roles: ["hosts"])
    @admins = @group.chat_channels.create!(name: "admins", access_roles: [], access_user_ids: [@bo.id])
  end

  test "members hear the channels they're in; others are turned away" do
    stub_connection(current_user: @ann)
    subscribe(group: @group.slug)
    assert subscription.confirmed?
    assert_has_stream @general.stream
    assert_has_stream @hosts.stream
    assert_has_no_stream @admins.stream
    assert_has_stream GroupChatChannel.group_stream(@group)

    assert_broadcast_on(@hosts.stream, type: "typing", channel_id: @hosts.id, user: { id: @ann.id, name: "Ann" }) do
      perform :typing, channel_id: @hosts.id
    end

    stub_connection(current_user: @bo)
    subscribe(group: @group.slug)
    assert subscription.rejected?, "Bo isn't in the group"
  end
end
