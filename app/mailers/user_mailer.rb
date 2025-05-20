class UserMailer < ApplicationMailer
  default from: 'support@hmblbot.com'

  def approval_notification(user)
    @user = user
    mail(
      to: @user.email,
      subject: 'Your HumbleBot Account Has Been Approved!'
    )
  end
end
