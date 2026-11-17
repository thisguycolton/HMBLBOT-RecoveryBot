class UserMailer < ApplicationMailer
  default from: 'support@hmblbot.com'

  def approval_notification(user)
    @user = user
    mail(
      to: @user.email,
      subject: 'Your HumbleBot Account Has Been Approved!'
    )
  end

  # Google or Apple was just linked from Account settings (LinksIdentities), so they hear about
  # it if it wasn't them
  def sign_in_linked(user, provider_label)
    @user = user
    @provider = provider_label
    @settings_url = edit_user_registration_url(anchor: "account")
    mail(to: @user.email, subject: "#{provider_label} sign-in was linked to your RecoveryBot account")
  end
end
