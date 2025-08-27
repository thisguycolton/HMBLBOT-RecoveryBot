require "application_system_test_case"

class TopicSetsTest < ApplicationSystemTestCase
  setup do
    @topic_set = topic_sets(:one)
  end

  test "visiting the index" do
    visit topic_sets_url
    assert_selector "h1", text: "Topic sets"
  end

  test "should create topic set" do
    visit topic_sets_url
    click_on "New topic set"

    fill_in "Description", with: @topic_set.description
    fill_in "Name", with: @topic_set.name
    click_on "Create Topic set"

    assert_text "Topic set was successfully created"
    click_on "Back"
  end

  test "should update Topic set" do
    visit topic_set_url(@topic_set)
    click_on "Edit this topic set", match: :first

    fill_in "Description", with: @topic_set.description
    fill_in "Name", with: @topic_set.name
    click_on "Update Topic set"

    assert_text "Topic set was successfully updated"
    click_on "Back"
  end

  test "should destroy Topic set" do
    visit topic_set_url(@topic_set)
    click_on "Destroy this topic set", match: :first

    assert_text "Topic set was successfully destroyed"
  end
end
