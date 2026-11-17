require "test_helper"

class ServiceReadingsControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers

  setup do
    @service_reading = service_readings(:one)
    @admin = User.create!(name: "Boss", email: "boss@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current, confirmed: true, admin: true)
    @member = User.create!(name: "Sam", email: "sam@example.com", password: "password123", password_confirmation: "password123", confirmed_at: Time.current, confirmed: true)
  end

  test "should get index" do
    get service_readings_url
    assert_response :success
  end

  test "should get new as an admin" do
    sign_in @admin
    get new_service_reading_url
    assert_response :success
    assert_includes response.body, %(id="service-reading-editor-root" class="w-full self-start")
  end

  test "only admins can open the form or save" do
    get new_service_reading_url
    assert_redirected_to new_user_session_url

    sign_in @member
    get edit_service_reading_url(@service_reading)
    assert_redirected_to service_readings_url

    assert_no_difference("ServiceReading.count") do
      post service_readings_url, params: { service_reading: { title: "Nope" } }, as: :json
    end
    assert_response :forbidden
  end

  test "should create service_reading" do
    sign_in @admin
    assert_difference("ServiceReading.count") do
      post service_readings_url, params: { service_reading: { short_title: @service_reading.short_title, source: @service_reading.source, title: @service_reading.title } }
    end

    assert_redirected_to service_reading_url(ServiceReading.last)
  end

  test "the React form creates a reading with its body and icon" do
    sign_in @admin
    assert_difference("ServiceReading.count") do
      post service_readings_url, params: { service_reading: { title: "How It Works", short_title: "HIW", source: "Big Book", icon: "list-ordered", body: "<p>Rarely have we seen</p>" } }, as: :json
    end
    reading = ServiceReading.last
    assert_response :created
    assert_equal service_reading_path(reading), response.parsed_body["redirect_url"]
    assert_equal "list-ordered", reading.icon
    assert_includes reading.body.to_plain_text, "Rarely have we seen"
  end

  test "should show service_reading" do
    get service_reading_url(@service_reading)
    assert_response :success
  end

  test "should get edit" do
    sign_in @admin
    get edit_service_reading_url(@service_reading)
    assert_response :success
  end

  test "should update service_reading" do
    sign_in @admin
    patch service_reading_url(@service_reading), params: { service_reading: { short_title: @service_reading.short_title, source: @service_reading.source, title: @service_reading.title } }
    assert_redirected_to service_reading_url(@service_reading)
  end

  test "the React form updates a reading" do
    sign_in @admin
    patch service_reading_url(@service_reading), params: { service_reading: { title: "The Promises", body: "<p>We are going to know</p>" } }, as: :json
    assert_response :success
    assert_equal "The Promises", @service_reading.reload.title
  end

  test "should destroy service_reading" do
    sign_in @admin
    assert_difference("ServiceReading.count", -1) do
      delete service_reading_url(@service_reading)
    end

    assert_redirected_to service_readings_url
  end
end
