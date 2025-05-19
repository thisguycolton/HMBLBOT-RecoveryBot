require "application_system_test_case"

class HostificatorsTest < ApplicationSystemTestCase
  setup do
    @hostificator = hostificators(:one)
  end

  test "visiting the index" do
    visit hostificators_url
    assert_selector "h1", text: "Hostificators"
  end

  test "should create hostificator" do
    visit hostificators_url
    click_on "New hostificator"

    fill_in "Meeting date time", with: @hostificator.meeting_date_time
    click_on "Create Hostificator"

    assert_text "Hostificator was successfully created"
    click_on "Back"
  end

  test "should update Hostificator" do
    visit hostificator_url(@hostificator)
    click_on "Edit this hostificator", match: :first

    fill_in "Meeting date time", with: @hostificator.meeting_date_time.to_s
    click_on "Update Hostificator"

    assert_text "Hostificator was successfully updated"
    click_on "Back"
  end

  test "should destroy Hostificator" do
    visit hostificator_url(@hostificator)
    click_on "Destroy this hostificator", match: :first

    assert_text "Hostificator was successfully destroyed"
  end
end
