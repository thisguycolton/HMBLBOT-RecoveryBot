require "test_helper"

class CourtLetterTest < ActiveSupport::TestCase
  def verification(group: nil)
    CourtVerification.new(respondent_name: "Pat R.", respondent_email: "pat@example.com", host_name: "Hal", signer_name: "Sue",
                           topic: "Step 3", group: group, meeting_at: Time.find_zone("America/Phoenix").local(2026, 10, 16, 19))
  end

  test "without a group it's the Acid Test letter, as before" do
    letter = verification.letter
    assert_equal "Verification of AA Meeting Attendance", letter.subject
    assert_includes letter.text, "This email verifies that Pat R. attended an Alcoholics Anonymous meeting."
    assert_includes letter.text, "Meeting date / time: Friday, October 16, 2026 at 7:00 PM MST"
    assert_includes letter.text, "Group: The Acid Test AA Meeting"
    assert_includes letter.text, "please email AAAcidTest@gmail.com"
    assert_includes letter.paragraphs, [["Meeting date / time", "Friday, October 16, 2026 at 7:00 PM MST"], ["Topic", "Step 3"], ["Host", "Hal"], ["Group", "The Acid Test AA Meeting"]]
  end

  test "a group's own wording, with its placeholders filled in" do
    group = groups(:one)
    assert_includes verification(group: group).letter.text, "Group: Sunrise Serenity"
    assert_includes verification(group: group).letter.text, "please reply to this email"

    group.update!(court_email_subject: "{{group}} attendance for {{attendee}}", court_email_body: "Hi,\n\n{{attendee}} was at {{group}} on {{meeting_time}}.\nTopic: {{ topic }}\n\n{{signer}}")
    letter = verification(group: group).letter
    assert_equal "Sunrise Serenity attendance for Pat R.", letter.subject
    assert_equal "Hi,\n\nPat R. was at Sunrise Serenity on Friday, October 16, 2026 at 7:00 PM MST.\nTopic: Step 3\n\nSue", letter.text
    assert_equal [[[nil, "Hi,"]], [[nil, "Pat R. was at Sunrise Serenity on Friday, October 16, 2026 at 7:00 PM MST."], ["Topic", "Step 3"]], [[nil, "Sue"]]], letter.paragraphs
  end

  test "groups can't save placeholders the form doesn't fill in, and the default is stored as blank" do
    group = groups(:one)
    assert_not group.update(court_email_body: "Hello {{judge}}")
    assert_match "{{judge}}", group.errors.full_messages.to_sentence

    group.update!(court_email_subject: CourtLetter::DEFAULT_SUBJECT, court_email_body: CourtLetter.default_body(group))
    assert_nil group.court_email_subject
    assert_nil group.court_email_body
  end

  test "the email uses the group's subject, name and contact" do
    group = groups(:one)
    group.update!(court_email_subject: "{{group}} verification", court_email_reply_to: "sunrise@example.com")
    mail = CourtVerificationMailer.with(court_verification: verification(group: group)).verification_email
    assert_equal "Sunrise Serenity verification", mail.subject
    assert_equal ["sunrise@example.com"], mail.cc
    assert_equal ["sunrise@example.com"], mail.reply_to
    assert_includes mail.html_part.body.to_s, "Sunrise Serenity"
    assert_not_includes mail.html_part.body.to_s, "Acid Test"
    assert_includes mail.text_part.body.to_s, "This email verifies that Pat R."
  end
end
