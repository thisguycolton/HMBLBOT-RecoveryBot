require "application_system_test_case"

class ServiceReadingsTest < ApplicationSystemTestCase
  setup do
    @service_reading = service_readings(:one)
  end

  test "visiting the index" do
    visit service_readings_url
    assert_selector "h1", text: "Service readings"
  end

  test "should create service reading" do
    visit service_readings_url
    click_on "New service reading"

    fill_in "Short title", with: @service_reading.short_title
    fill_in "Source", with: @service_reading.source
    fill_in "Title", with: @service_reading.title
    click_on "Create Service reading"

    assert_text "Service reading was successfully created"
    click_on "Back"
  end

  test "should update Service reading" do
    visit service_reading_url(@service_reading)
    click_on "Edit this service reading", match: :first

    fill_in "Short title", with: @service_reading.short_title
    fill_in "Source", with: @service_reading.source
    fill_in "Title", with: @service_reading.title
    click_on "Update Service reading"

    assert_text "Service reading was successfully updated"
    click_on "Back"
  end

  test "should destroy Service reading" do
    visit service_reading_url(@service_reading)
    click_on "Destroy this service reading", match: :first

    assert_text "Service reading was successfully destroyed"
  end
end
