require "application_system_test_case"

class TopicCategoriesTest < ApplicationSystemTestCase
  setup do
    @topic_category = topic_categories(:one)
  end

  test "visiting the index" do
    visit topic_categories_url
    assert_selector "h1", text: "Topic categories"
  end

  test "should create topic category" do
    visit topic_categories_url
    click_on "New topic category"

    fill_in "Cat", with: @topic_category.cat
    fill_in "Icon", with: @topic_category.icon
    fill_in "Title", with: @topic_category.title
    click_on "Create Topic category"

    assert_text "Topic category was successfully created"
    click_on "Back"
  end

  test "should update Topic category" do
    visit topic_category_url(@topic_category)
    click_on "Edit this topic category", match: :first

    fill_in "Cat", with: @topic_category.cat
    fill_in "Icon", with: @topic_category.icon
    fill_in "Title", with: @topic_category.title
    click_on "Update Topic category"

    assert_text "Topic category was successfully updated"
    click_on "Back"
  end

  test "should destroy Topic category" do
    visit topic_category_url(@topic_category)
    click_on "Destroy this topic category", match: :first

    assert_text "Topic category was successfully destroyed"
  end
end
