class ChipMailer < ApplicationMailer
  default from: "support@hmblbot.com"

  # A chip given to an address with no account yet (ChipAward): a link to claim it
  def given
    @award = params[:award]
    @from = @award.given_by&.display_name
    @url = "#{root_url.chomp('/')}/chips/claim/#{@award.claim_token}"
    mail(to: @award.email, subject: "#{@award.group.title} sent you a #{@award.label} chip")
  end
end
