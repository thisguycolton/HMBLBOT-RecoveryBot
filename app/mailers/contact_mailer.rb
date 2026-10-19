# Messages from the Contact page (/contact): each is saved as a ContactRequest (admin suite >
# Contact requests) and emailed to RECIPIENT.
class ContactMailer < ApplicationMailer
  RECIPIENT = "support@hmblbot.com"
  default from: RECIPIENT

  TOPICS = {
    "general" => "A question or idea",
    "problem" => "Something isn't working",
    "privacy" => "Privacy or deleting my data",
    "group" => "A group or meeting listing",
  }.freeze

  # params: contact_request
  def message_sent
    contact = params[:contact_request]
    @name = contact.name.presence || "Someone"
    @email = contact.email
    @topic = contact.topic_label
    @message = contact.message
    @user = contact.user
    @admin_url = "#{root_url.chomp('/')}/admin_panel/contact_requests"
    mail(to: RECIPIENT, reply_to: @email, subject: "[RecoveryBot] #{@topic}: from #{@name}")
  end
end
