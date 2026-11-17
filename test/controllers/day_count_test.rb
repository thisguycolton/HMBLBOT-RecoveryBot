require "test_helper"

# The day count modal after signing in (config/initializers/day_count.rb, the toasts partial)
class DayCountTest < ActionDispatch::IntegrationTest
  setup { Rails.application.reload_routes_unless_loaded }

  def member(sobriety_date)
    User.create!(name: "Kim", email: "kim@example.com", password: "password123", password_confirmation: "password123",
                 sobriety_date: sobriety_date, confirmed_at: Time.current)
  end

  def log_in
    post "/users/sign_in", params: { user: { email: "kim@example.com", password: "password123" } }
    follow_redirect!
  end

  test "the first page after signing in opens the day count, and only that one" do
    member(Date.current - 400)
    log_in
    assert_select "#hb-toasts[data-sober-since=?][data-day-count-login=true]", (Date.current - 400).iso8601

    get "/"
    assert_select "#hb-toasts[data-sober-since]"
    assert_select "#hb-toasts[data-day-count-login]", false
  end

  test "no sobriety date, no day count" do
    member(nil)
    log_in
    assert_select "#hb-toasts[data-sober-since]", false
    assert_select "#hb-toasts[data-day-count-login]", false
  end
end
