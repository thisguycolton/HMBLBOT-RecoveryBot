require "test_helper"

class TopicSetsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @topic_set = topic_sets(:one)
  end

  test "should get index" do
    get topic_sets_url
    assert_response :success
  end

  test "should get new" do
    get new_topic_set_url
    assert_response :success
  end

  test "should create topic_set" do
    assert_difference("TopicSet.count") do
      post topic_sets_url, params: { topic_set: { description: @topic_set.description, name: @topic_set.name } }
    end

    assert_redirected_to topic_set_url(TopicSet.last)
  end

  test "should show topic_set" do
    get topic_set_url(@topic_set)
    assert_response :success
  end

  test "should get edit" do
    get edit_topic_set_url(@topic_set)
    assert_response :success
  end

  test "should update topic_set" do
    patch topic_set_url(@topic_set), params: { topic_set: { description: @topic_set.description, name: @topic_set.name } }
    assert_redirected_to topic_set_url(@topic_set)
  end

  test "should destroy topic_set" do
    assert_difference("TopicSet.count", -1) do
      delete topic_set_url(@topic_set)
    end

    assert_redirected_to topic_sets_url
  end
end
