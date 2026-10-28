require "test_helper"

class ChipsChannelTest < ActionCable::Channel::TestCase
  self.fixture_table_names = []

  test "a signed-in member hears about their own chips; nobody else listens" do
    kim = User.create!(email: "kim@example.com", password: "password123", confirmed: true, name: "Kim")
    stub_connection(current_user: kim)
    subscribe
    assert subscription.confirmed?
    assert_has_stream_for kim

    stub_connection(current_user: nil)
    subscribe
    assert subscription.rejected?
  end
end
