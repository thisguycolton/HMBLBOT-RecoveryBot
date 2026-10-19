require "test_helper"

class Api::IntergroupFollowsTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  self.fixture_table_names = []

  setup do
    Rails.application.reload_routes_unless_loaded
    @fan = User.create!(email: "fan@example.com", name: "Fay", password: "password123", confirmed: true)
    @admin_email = ENV["ADMIN_EMAILS"]
    ENV["ADMIN_EMAILS"] = "boss@example.com"
    @boss = User.create!(email: "boss@example.com", name: "Bo", password: "password123", confirmed: true, admin: true)
    @record = OiaaMeeting.new(slug: "sunrise-crew-7am", name: "Sunrise Crew 7am", group_name: "Sunrise Crew")
  end

  teardown { ENV["ADMIN_EMAILS"] = @admin_email }

  test "followers hear once when a group by that name is approved" do
    IntergroupFollow.create!(user: @fan, group_name: IntergroupFollow.key_for(@record), oiaa_slug: @record.slug)
    group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix", status: "pending")
    group.memberships.create!(user: @boss, role: "admin")

    sign_in @boss
    post "/api/groups/#{group.slug}/approve", as: :json
    assert_response :success
    assert Notification.exists?(user: @fan, kind: "group.followed_arrived")

    assert_no_difference -> { Notification.where(kind: "group.followed_arrived").count } do
      IntergroupFollow.announce!(group)
    end
  end
end
