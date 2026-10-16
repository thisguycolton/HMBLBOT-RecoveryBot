require "test_helper"

class Api::CourtVerificationsControllerTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper

  def valid_params
    {
      respondent_name: "Jane Doe",
      respondent_email: "jane@example.com",
      meeting_at: "2025-11-16T19:00:00-07:00",
      host_name: "Host",
      signer_name: "Signer",
      topic: "Step One"
    }
  end

  test "creates a verification and emails the respondent" do
    assert_difference("CourtVerification.count") do
      assert_enqueued_emails 1 do
        post api_court_verifications_url, params: { court_verification: valid_params }, as: :json
      end
    end

    assert_response :created
  end

  test "rejects an invalid email address" do
    assert_no_difference("CourtVerification.count") do
      post api_court_verifications_url,
           params: { court_verification: valid_params.merge(respondent_email: "not-an-email") },
           as: :json
    end

    assert_response :unprocessable_entity
  end
end
