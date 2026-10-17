require "test_helper"
require_relative "../support/court_verification_test_data"

class CourtVerificationMailerTest < ActionMailer::TestCase
  include CourtVerificationTestData

  test "bundle_email holds every verification, oldest first" do
    later = create_verification(name: "Pat Sample", meeting_at: "2026-09-24 19:00")
    earlier = create_verification(name: "Pat Sample", meeting_at: "2026-08-14 19:00")

    mail = CourtVerificationMailer.with(recipient: "person@example.com", ids: [later.id, earlier.id]).bundle_email

    assert_equal ["person@example.com"], mail.to
    assert_equal ["support@hmblbot.com"], mail.from
    assert_equal "Verification of AA Meeting Attendance (2 meetings) - Pat Sample", mail.subject
    body = mail.html_part ? mail.html_part.body.to_s : mail.body.to_s
    assert_equal 2, body.scan("attended an Alcoholics Anonymous meeting").size
    assert_operator body.index("August 14, 2026"), :<, body.index("September 24, 2026")
  end
end
