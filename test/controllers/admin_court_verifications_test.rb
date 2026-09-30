require "test_helper"
require_relative "../support/court_verification_test_data"

class AdminCourtVerificationsTest < ActionDispatch::IntegrationTest
  include CourtVerificationTestData
  include Devise::Test::IntegrationHelpers
  include ActionMailer::TestHelper

  setup do
    @previous_allowed = ENV["COURT_VERIFICATION_ADMIN_EMAILS"]
    ENV["COURT_VERIFICATION_ADMIN_EMAILS"] = "someone@example.com, Court-Admin@example.com"
    # Phoenix is UTC-7 all year: 7pm on Aug 13 there is already Aug 14 in UTC
    @before = create_verification(name: "Pat Sample", meeting_at: "2026-08-13 19:00")
    @first = create_verification(name: "Pat Sample", meeting_at: "2026-08-14 07:00")
    @last = create_verification(name: "pat SAMPLE", meeting_at: "2026-09-24 23:30")
    @after = create_verification(name: "Pat Sample", meeting_at: "2026-09-25 07:00")
    @other = create_verification(name: "Someone Else", meeting_at: "2026-09-01 19:00", email: "else@example.com")
  end

  teardown { ENV["COURT_VERIFICATION_ADMIN_EMAILS"] = @previous_allowed }

  test "other admins can't use it either" do
    sign_in create_user(admin: true)

    get admin_panel_court_verifications_path
    assert_redirected_to root_path
    get api_admin_court_verifications_path, as: :json
    assert_response :forbidden
  end

  test "non-admins can't see the page, the API, the print view or send email" do
    sign_in create_user(admin: false)

    get admin_panel_court_verifications_path
    assert_redirected_to root_path
    get print_admin_panel_court_verifications_path
    assert_redirected_to root_path
    get api_admin_court_verifications_path, as: :json
    assert_response :forbidden
    assert_no_enqueued_emails do
      post send_bundle_api_admin_court_verifications_path, params: { recipient: "x@example.com" }, as: :json
    end
    assert_response :forbidden
  end

  test "signed-out visitors are sent to sign in" do
    get admin_panel_court_verifications_path
    assert_redirected_to new_user_session_path
  end

  test "filters by name, ignoring case, and by Phoenix meeting days inclusive" do
    sign_in create_court_admin
    get api_admin_court_verifications_path(name: "sample", from: "2026-08-14", to: "2026-09-24"), as: :json

    assert_response :success
    body = response.parsed_body
    assert_equal 2, body["total"]
    assert_equal [@last.id, @first.id], body["court_verifications"].map { |v| v["id"] }
  end

  test "filters by email and ignores a bad date" do
    sign_in create_court_admin
    get api_admin_court_verifications_path(email: "ELSE@", from: "not-a-date"), as: :json

    assert_equal [@other.id], response.parsed_body["court_verifications"].map { |v| v["id"] }
  end

  test "CSV lists every match oldest first" do
    sign_in create_court_admin
    get api_admin_court_verifications_path(format: :csv, name: "sample", from: "2026-08-14", to: "2026-09-24")

    assert_response :success
    assert_equal "text/csv", response.media_type
    rows = CSV.parse(response.body)
    assert_equal "Meeting (Phoenix time)", rows.first.first
    assert_equal ["Friday, August 14, 2026 at 7:00 AM MST", "Thursday, September 24, 2026 at 11:30 PM MST"], rows.drop(1).map(&:first)
  end

  test "print view renders one letter per match" do
    sign_in create_court_admin
    get print_admin_panel_court_verifications_path(name: "sample", from: "2026-08-14", to: "2026-09-24")

    assert_response :success
    assert_select "section.letter", 2
    assert_match "attended an Alcoholics Anonymous meeting", response.body
  end

  test "emails every match in one message" do
    sign_in create_court_admin

    assert_enqueued_emails 1 do
      post send_bundle_api_admin_court_verifications_path,
           params: { recipient: "person@example.com", name: "sample", from: "2026-08-14", to: "2026-09-24" }, as: :json
    end
    assert_response :success
    assert_equal 2, response.parsed_body["sent"]
  end

  test "won't email without a valid address or with no matches" do
    sign_in create_court_admin

    assert_no_enqueued_emails do
      post send_bundle_api_admin_court_verifications_path, params: { recipient: "nope" }, as: :json
      assert_response :unprocessable_entity
      post send_bundle_api_admin_court_verifications_path, params: { recipient: "a@example.com", name: "nobody" }, as: :json
      assert_response :unprocessable_entity
    end
  end
end
