class HostMailer < ApplicationMailer
  default from: "support@hmblbot.com"

  # "You're hosting <meeting> tomorrow at 9:00 AM", for hosts who asked to be reminded
  def reminder
    @title = params[:title]
    @body = params[:body]
    @url = "#{root_url.chomp('/')}/groups/#{params[:group].slug}/hosts"
    @settings_url = "#{root_url.chomp('/')}/users/edit#hosting"
    mail(to: params[:user].email, subject: @title)
  end
end
