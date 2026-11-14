require "test_helper"

class NotificationsChannelTest < ActionCable::Channel::TestCase
  self.fixture_table_names = []

  test "a signed-in member hears about their own new notifications; visitors can't listen" do
    kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim")
    stub_connection(current_user: kim)
    subscribe
    assert subscription.confirmed?
    assert_has_stream_for kim

    assert_broadcast_on(NotificationsChannel.broadcasting_for(kim), { changed: true }) do
      Notification.deliver(kim, kind: "follow.created", title: "Sam followed you")
    end

    stub_connection(current_user: nil)
    subscribe
    assert subscription.rejected?
  end
end
