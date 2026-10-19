# Messages from the Contact page (/contact). They're only emailed, never stored in the app.
class ContactMailer < ApplicationMailer
  default from: "support@hmblbot.com"

  TOPICS = {
    "general" => "A question or idea",
    "problem" => "Something isn't working",
    "privacy" => "Privacy or deleting my data",
    "group" => "A group or meeting listing",
  }.freeze

  # Who gets them: CONTACT_EMAIL, else the site admins (ADMIN_EMAILS); comma-separated
  def self.recipients
    (ENV["CONTACT_EMAIL"].presence || ENV["ADMIN_EMAILS"].presence || ENV["COURT_VERIFICATION_ADMIN_EMAILS"]).to_s
      .split(",").map(&:strip).reject(&:blank?)
  end

  # params: name, email, topic, message, user (signed in, or nil)
  def message_sent
    @name = params[:name].presence || "Someone"
    @email = params[:email]
    @topic = TOPICS.fetch(params[:topic], TOPICS["general"])
    @message = params[:message]
    @user = params[:user]
    mail(to: self.class.recipients, reply_to: @email, subject: "[RecoveryBot] #{@topic}: from #{@name}")
  end
end
