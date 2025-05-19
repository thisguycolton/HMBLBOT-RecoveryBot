require "test_helper"

class HostificatorsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @hostificator = hostificators(:one)
  end

  test "should get index" do
    get hostificators_url
    assert_response :success
  end

  test "should get new" do
    get new_hostificator_url
    assert_response :success
  end

  test "should create hostificator" do
    assert_difference("Hostificator.count") do
      post hostificators_url, params: { hostificator: { meeting_date_time: @hostificator.meeting_date_time } }
    end

    assert_redirected_to hostificator_url(Hostificator.last)
  end

  test "should show hostificator" do
    get hostificator_url(@hostificator)
    assert_response :success
  end

  test "should get edit" do
    get edit_hostificator_url(@hostificator)
    assert_response :success
  end

  test "should update hostificator" do
    patch hostificator_url(@hostificator), params: { hostificator: { meeting_date_time: @hostificator.meeting_date_time } }
    assert_redirected_to hostificator_url(@hostificator)
  end

  test "should destroy hostificator" do
    assert_difference("Hostificator.count", -1) do
      delete hostificator_url(@hostificator)
    end

    assert_redirected_to hostificators_url
  end
end
