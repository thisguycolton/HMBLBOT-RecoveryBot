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
    assert_equal "new@example.com", @user.reload.email
  end
end
