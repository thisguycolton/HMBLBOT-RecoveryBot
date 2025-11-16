class CourtVerificationMailer < ApplicationMailer
  default from: "support@hmblbot.com"

  def verification_email
    @court_verification = params[:court_verification]

    mail(
      to: @court_verification.respondent_email,
      subject: "Verification of AA Meeting Attendance"
    )
  end
end
