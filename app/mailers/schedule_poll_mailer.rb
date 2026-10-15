class SchedulePollMailer < ApplicationMailer
  default from: "support@hmblbot.com"

  # A user was tagged on a schedule poll, as a collaborator or to vote
  def tagged
    @member = params[:member]
    @poll = @member.schedule_poll
    @organizer = @poll.user.name.presence || @poll.user.email
    @url = schedule_poll_url(@poll)
    subject = @member.role == "collaborator" ? "Help run “#{@poll.title}” on HumbleBot" : "When works for you? “#{@poll.title}”"
    mail(to: @member.user.email, subject: subject)
  end
end
