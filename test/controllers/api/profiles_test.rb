require "test_helper"

class Api::ProfilesTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @user = User.create!(email: "me@example.com", name: "Me", password: "password123", confirmed: true)
    sign_in @user
  end

  test "the profile page replaces Devise's edit page" do
    get "/users/edit"
    assert_response :success
    assert_includes response.body, "profile-root"
  end

  test "name, blurb and picture save without a password" do
    patch "/api/profile", params: { profile: { name: "New", bio: "Sober since 2019.",
                                               avatar: fixture_file_upload("avatar.png", "image/png") } }
    assert_response :success
    assert_equal ["New", "Sober since 2019."], [@user.reload.name, @user.bio]
    assert @user.avatar.attached?
    assert response.parsed_body["avatar_url"].present?

    patch "/api/profile", params: { profile: { bio: "x" * 281 } }, as: :json
    assert_response :unprocessable_entity

    patch "/api/profile", params: { profile: { remove_avatar: "1" } }, as: :json
    assert_response :success
  end

  test "changing email or password needs the current password" do
    patch "/api/profile", params: { profile: { email: "new@example.com" } }, as: :json
    assert_response :unprocessable_entity
    patch "/api/profile", params: { profile: { email: "new@example.com", current_password: "password123" } }, as: :json
    assert_response :success
    assert_equal "new@example.com", @user.reload.unconfirmed_email # it changes once they confirm it
  end

  test "sobriety date is private unless they show it to their groups" do
    patch "/api/profile", params: { profile: { sobriety_date: "2019-03-14", show_sobriety_date: "0" } }
    assert_response :success
    assert_equal "2019-03-14", response.parsed_body["sobriety_date"]
    assert_nil @user.reload.as_member_json[:sobriety_date]

    patch "/api/profile", params: { profile: { show_sobriety_date: "1" } }
    assert_equal "2019-03-14", @user.reload.as_member_json[:sobriety_date]

    patch "/api/profile", params: { profile: { sobriety_date: (Date.current + 10).iso8601 } }
    assert_response :unprocessable_entity
  end

  test "deleting the account takes the password and removes what's only theirs" do
    group = Group.create!(title: "Sunrise Crew", time_zone: "America/Phoenix")
    group.memberships.create!(user: @user, role: "admin")
    other = User.create!(email: "o@example.com", name: "O", password: "password123", confirmed: true)
    Follow.create!(follower: @user, followed: other)
    Follow.create!(follower: other, followed: @user)
    meeting = group.meetings.create!(name: "Sunrise", recurrence: "weekly", day_of_week: 1, start_minute: 420)
    sub = HostSubRequest.new(meeting: meeting, requested_by: @user, filled_by: @user, role: "host", status: "open", on: Date.current)
    sub.save!(validate: false)
    IntergroupFollow.create!(user: @user, group_name: "desert dawn group", oiaa_slug: "desert-dawn")
    visit = Ahoy::Visit.create!(visit_token: "v1", visitor_token: "u1", user: @user, started_at: Time.current)

    delete "/api/profile", params: { current_password: "wrong" }, as: :json
    assert_response :unprocessable_entity
    assert User.exists?(@user.id)

    delete "/api/profile", params: { current_password: "password123" }, as: :json
    assert_response :no_content
    refute User.exists?(@user.id)
    assert_empty Follow.where(follower_id: @user.id).or(Follow.where(followed_id: @user.id))
    assert_nil visit.reload.user_id
    assert_nil sub.reload.requested_by_id
    assert Group.exists?(group.id)

    get "/api/profile", as: :json
    assert_response :unauthorized
  end

  test "an account that added readings is pointed to the contact page instead" do
    Reading.new(user: @user, title: "Just for today").save!(validate: false)
    delete "/api/profile", params: { current_password: "password123" }, as: :json
    assert_response :unprocessable_entity
    assert_includes response.parsed_body["error"], "Contact page"
    assert User.exists?(@user.id)
  end
end
