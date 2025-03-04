require "test_helper"

class TopicCategoriesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @topic_category = topic_categories(:one)
  end

  test "should get index" do
    get topic_categories_url
    assert_response :success
  end

  test "should get new" do
    get new_topic_category_url
    assert_response :success
  end

  test "should create topic_category" do
    assert_difference("TopicCategory.count") do
      post topic_categories_url, params: { topic_category: { cat: @topic_category.cat, icon: @topic_category.icon, title: @topic_category.title } }
    end

    assert_redirected_to topic_category_url(TopicCategory.last)
  end

  test "should show topic_category" do
    get topic_category_url(@topic_category)
    assert_response :success
  end

  test "should get edit" do
    get edit_topic_category_url(@topic_category)
    assert_response :success
  end

  test "should update topic_category" do
    patch topic_category_url(@topic_category), params: { topic_category: { cat: @topic_category.cat, icon: @topic_category.icon, title: @topic_category.title } }
    assert_redirected_to topic_category_url(@topic_category)
  end

  test "should destroy topic_category" do
    assert_difference("TopicCategory.count", -1) do
      delete topic_category_url(@topic_category)
    end

    assert_redirected_to topic_categories_url
  end
end
