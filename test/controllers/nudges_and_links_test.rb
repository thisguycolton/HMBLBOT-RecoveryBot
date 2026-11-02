require "test_helper"

# A sponsor nudging a sponsee about their step work, and a worksheet's password-protected link
class NudgesAndLinksTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    Rails.application.reload_routes_unless_loaded
    @pat = person("Pat")
    @sam = person("Sam")
    @link = Sponsorship.create!(sponsor: @pat, sponsee: @sam, status: "active", started_on: Date.current, current_step: 4)
  end

  def person(name)
    User.create!(name: name, email: "#{name.downcase}@example.com", password: "password123", password_confirmation: "password123",
                 confirmed_at: Time.current, confirmed: true)
  end

  def as(user)
    sign_out :user
    sign_in user
  end

  test "a sponsor nudges once a day; it waits on the sponsee's Steps until they work on something" do
    as @pat
    post "/api/sponsorships/#{@link.id}/nudge", params: { note: "How's the 4th going?" }, as: :json
    assert_response :success
    note = @sam.notifications.last
    assert_equal ["sponsorship.nudge", "How's the 4th going?"], [note.kind, note.body]
    post "/api/sponsorships/#{@link.id}/nudge", as: :json
    assert_response :unprocessable_entity

    as @sam
    post "/api/sponsorships/#{@link.id}/nudge", as: :json
    assert_response :not_found # only the sponsor
    get "/api/step_works"
    assert_includes response.parsed_body["attention"].map { |i| i["title"] }, "Pat is checking in on your step work"

    travel 1.minute do
      post "/api/step_works", params: { tool_key: "step4-big-book" }, as: :json
      get "/api/step_works"
      assert_not_includes response.parsed_body["attention"].map { |i| i["title"] }, "Pat is checking in on your step work"
    end
  end

  test "a worksheet's link opens with its password only, and stops when turned off" do
    as @sam
    post "/api/step_works", params: { tool_key: "step4-big-book" }, as: :json
    work = StepWork.find(response.parsed_body.dig("work", "id"))
    work.update!(answers: { "resentments" => [{ "who" => "My boss" }] })

    post "/api/step_works/#{work.id}/link", params: { password: "short" }, as: :json
    assert_response :unprocessable_entity
    post "/api/step_works/#{work.id}/link", params: { password: "coffee123" }, as: :json
    path = response.parsed_body.dig("work", "link", "path")
    token = path.split("/").last

    sign_out :user
    get path
    assert_response :success
    assert_not_includes response.body, "My boss"
    assert_equal "noindex, nofollow", response.headers["X-Robots-Tag"]

    post "/api/shared_worksheets/#{token}", params: { password: "wrong" }, as: :json
    assert_response :unauthorized
    post "/api/shared_worksheets/#{token}", params: { password: "coffee123" }, as: :json
    assert_response :success
    assert_equal ["Big Book four columns", "My boss", "Sam"],
                 [response.parsed_body.dig("work", "name"), response.parsed_body.dig("work", "answers", "resentments", 0, "who"), response.parsed_body.dig("work", "by")]
    assert work.reload.share_viewed_at

    as @sam
    post "/api/step_works/#{work.id}/link", params: { password: "coffee123", new_link: true }, as: :json
    sign_out :user
    post "/api/shared_worksheets/#{token}", params: { password: "coffee123" }, as: :json
    assert_response :unauthorized # the old link stopped

    as @sam
    delete "/api/step_works/#{work.id}/link"
    assert_nil work.reload.share_token
    assert_nil response.parsed_body.dig("work", "link")

    as @pat
    post "/api/step_works/#{work.id}/link", params: { password: "coffee123" }, as: :json
    assert_response :not_found
  end
end
