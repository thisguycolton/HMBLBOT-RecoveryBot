require "test_helper"
require "minitest/mock"

# GET /meeting_maps/:kind/:id.png (MeetingMapsController)
class MeetingMapsTest < ActionDispatch::IntegrationTest
  self.fixture_table_names = []

  test "a listing's map is public; an unknown or placeless one is a 404" do
    list = MeetingDirectory.create!(name: "Phoenix Area Intergroup", key: "phx")
    feed = [{ slug: "m", name: "Monday", day: 1, time: "19:00", formatted_address: "1 Elm St, Mesa, AZ", latitude: "33.41", longitude: "-111.83" },
            { slug: "z", name: "Zoom", day: 2, time: "19:00", conference_url: "https://zoom.us/j/123456789" }].to_json
    MeetingListImport.new(list, text: feed).apply!(keys: %w[phx-m phx-z])
    map = Minitest::Mock.new
    map.expect(:path, Rails.root.join("lib/share_cards/recoverybot-mark-light.png"))
    MeetingMap.stub(:for, ->(_r) { map }) do
      get "/meeting_maps/listing/phx-m.png"
    end
    assert_response :success
    assert_equal "image/png", response.media_type

    get "/meeting_maps/listing/phx-z.png"
    assert_response :not_found
    get "/meeting_maps/listing/nope.png"
    assert_response :not_found
  end

  test "a group's meeting map follows who may see the group's page" do
    group = Group.create!(title: "Quiet Group", status: "pending")
    meeting = group.meetings.create!(name: "Monday", day_of_week: 1, start_minute: 1140, formatted_address: "1 Elm St", latitude: 33.4, longitude: -112)
    get "/meeting_maps/meeting/#{meeting.id}.png"
    assert_response :not_found
  end
end
