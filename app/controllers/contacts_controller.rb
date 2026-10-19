# The Contact page (/contact): a form that saves a ContactRequest (admin suite > Contact
# requests) and emails it to ContactMailer::RECIPIENT, with HumanCheck and a rate limit in
# front of it.
class ContactsController < ApplicationController
  layout "reader"
  rate_limit to: 5, within: 1.hour, only: :create, with: -> { show_form("You've sent a few messages already. Please try again in a little while.", status: :too_many_requests) }

  # GET /contact
  def new
    show_form
  end

  # POST /contact
  def create
    return show_form("That didn't look like a person writing. Please try again.") unless HumanCheck.passed?(params, remote_ip: request.remote_ip)

    contact_request = ContactRequest.new(contact.merge(user: current_user))
    contact_request.topic = "general" unless ContactMailer::TOPICS.key?(contact_request.topic)
    return show_form(*contact_request.errors.map { |e| error_message(e) }) unless contact_request.save

    # It's saved either way; an email that fails still shows up in the admin suite
    begin
      ContactMailer.with(contact_request:).message_sent.deliver_now
    rescue StandardError => e
      Rails.logger.error("Contact request #{contact_request.id} not emailed: #{e.class}: #{e.message}")
    end
    redirect_to contact_path(sent: 1)
  end

  private

  def contact
    @contact ||= params.fetch(:contact, {}).permit(:name, :email, :topic, :message)
  end

  def error_message(error)
    case error.attribute
    when :email then "Please add an email address we can reply to."
    when :message then error.type == :blank ? "Please write a message." : "Please keep your message under #{ContactRequest::MAX_MESSAGE} characters."
    else error.full_message
    end
  end

  def show_form(*errors, status: nil)
    @props = {
      action: contact_path, authenticity_token: form_authenticity_token,
      sent: params[:sent].present?, errors: errors.uniq,
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
