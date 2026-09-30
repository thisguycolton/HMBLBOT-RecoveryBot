class CourtVerificationMailer < ApplicationMailer
  default from: "support@hmblbot.com"

  def verification_email
    @court_verification = params[:court_verification]

    mail(
      to: @court_verification.respondent_email,
      cc: ENV["ACID_TEST_GROUP_EMAIL"],
      subject: "Verification of AA Meeting Attendance"
    )
  end

  # Several verifications in one email, for someone who needs a batch at once (sent from the
  # admin lookup). params: recipient, ids
  def bundle_email
    @court_verifications = CourtVerification.where(id: params[:ids]).order(:meeting_at).to_a
    names = @court_verifications.map(&:respondent_name).uniq
    @subject = "Verification of AA Meeting Attendance (#{@court_verifications.size} meeting#{'s' unless @court_verifications.size == 1})"
    @subject += " - #{names.first}" if names.one?

    mail(to: params[:recipient], cc: ENV["ACID_TEST_GROUP_EMAIL"], subject: @subject)
  end
end
