# The Contact page (/contact): a form that emails the site admins (ContactMailer), with
# HumanCheck and a rate limit in front of it. Nothing sent here is saved in the app.
class ContactsController < ApplicationController
  layout "reader"
  rate_limit to: 5, within: 1.hour, only: :create, with: -> { show_form("You've sent a few messages already. Please try again in a little while.", status: :too_many_requests) }

  MAX_MESSAGE = 5000

  # GET /contact
  def new
    show_form
  end

  # POST /contact
  def create
    return show_form("That didn't look like a person writing. Please try again.") unless HumanCheck.passed?(params, remote_ip: request.remote_ip)

    errors = []
    errors << "Please add an email address we can reply to." unless contact[:email].to_s.match?(URI::MailTo::EMAIL_REGEXP)
    errors << "Please write a message." if contact[:message].blank?
    errors << "Please keep your message under #{MAX_MESSAGE} characters." if contact[:message].to_s.length > MAX_MESSAGE
    return show_form(*errors) if errors.any?
    return show_form("Messages aren't set up on this site yet.") if ContactMailer.recipients.empty?

    ContactMailer.with(**contact.to_h.symbolize_keys, user: current_user).message_sent.deliver_now
    redirect_to contact_path(sent: 1)
  rescue StandardError => e
    Rails.logger.error("Contact message not sent: #{e.class}: #{e.message}")
    show_form("Your message couldn't be sent just now. Please try again in a few minutes.")
  end

  private

  def contact
    @contact ||= params.fetch(:contact, {}).permit(:name, :email, :topic, :message)
  end

  def show_form(*errors, status: nil)
    @props = {
      action: contact_path, authenticity_token: form_authenticity_token,
      sent: params[:sent].present?, errors: errors,
      configured: ContactMailer.recipients.any?,
      topics: ContactMailer::TOPICS.map { |value, label| { value:, label: } },
      values: {
        name: contact[:name] || current_user&.name, email: contact[:email] || current_user&.email,
        topic: contact[:topic].presence || params[:topic].presence || "general", message: contact[:message],
      },
      human_check: HumanCheck.fields,
    }
    render :new, status: status || (errors.any? ? :unprocessable_entity : :ok)
  end
end
