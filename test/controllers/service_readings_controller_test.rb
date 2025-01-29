require "test_helper"

class ServiceReadingsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @service_reading = service_readings(:one)
  end

  test "should get index" do
    get service_readings_url
    assert_response :success
  end

  test "should get new" do
    get new_service_reading_url
    assert_response :success
  end

  test "should create service_reading" do
    assert_difference("ServiceReading.count") do
      post service_readings_url, params: { service_reading: { short_title: @service_reading.short_title, source: @service_reading.source, title: @service_reading.title } }
    end

    assert_redirected_to service_reading_url(ServiceReading.last)
  end

  test "should show service_reading" do
    get service_reading_url(@service_reading)
    assert_response :success
  end

  test "should get edit" do
    get edit_service_reading_url(@service_reading)
    assert_response :success
  end

  test "should update service_reading" do
    patch service_reading_url(@service_reading), params: { service_reading: { short_title: @service_reading.short_title, source: @service_reading.source, title: @service_reading.title } }
    assert_redirected_to service_reading_url(@service_reading)
  end

  test "should destroy service_reading" do
    assert_difference("ServiceReading.count", -1) do
      delete service_reading_url(@service_reading)
    end

    assert_redirected_to service_readings_url
  end
end
