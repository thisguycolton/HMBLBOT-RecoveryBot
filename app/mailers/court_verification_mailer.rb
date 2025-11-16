class CourtVerificationMailer < ApplicationMailer
  default from: "verifications@yourgroup.org" # change to your real from address

  def verification_email(court_verification)
    @court_verification = court_verification

    mail(
      to: @court_verification.respondent_email,
      subject: "Verification of AA Meeting Attendance"
    )
  end
end
