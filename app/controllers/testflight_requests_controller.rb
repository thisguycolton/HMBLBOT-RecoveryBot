# /testflight: a short form to ask for an invite to the iPhone app's TestFlight beta. Saves a
# TestflightRequest (Site Admin > TestFlight requests, site admins get a notification), with
# HumanCheck and a rate limit in front of it. Not in the nav or sitemap, and noindex (the
# default); link it from a site notice (Site Admin > Site notices, link /testflight).
class TestflightRequestsController < ApplicationController
  layout "reader"
  rate_limit to: 5, within: 1.hour, only: :create, with: -> { show_form("You've asked a few times already. Please try again in a little while.", status: :too_many_requests) }

  # GET /testflight
  def new
    show_form
  end

  # POST /testflight
  def create
    return show_form("That didn't look like a person writing. Please try again.") unless HumanCheck.passed?(params, remote_ip: request.remote_ip)

    attrs = form
    unless TestflightRequest.pending_for(attrs[:email])
      testflight_request = TestflightRequest.new(attrs.merge(user: current_user))
      return show_form(*testflight_request.errors.map { |e| error_message(e) }) unless testflight_request.save
    end
    redirect_to testflight_path(sent: 1)
  end

  private

  def form
    @form ||= params.fetch(:testflight, {}).permit(:name, :email, :note)
  end

  def error_message(error)
    case error.attribute
    when :name then error.type == :blank ? "Please add your name." : "Please keep your name under 100 characters."
    when :email then "Please add the email address you use for your Apple ID."
    when :note then "Please keep the note under #{TestflightRequest::MAX_NOTE} characters."
    else error.full_message
    end
  end

  def show_form(*errors, status: nil)
    @props = {
      action: testflight_path, authenticity_token: form_authenticity_token,
      sent: params[:sent].present?, errors: errors.uniq,
      values: {
        name: form[:name] || current_user&.name, email: form[:email] || current_user&.email, note: form[:note],
      },
      human_check: HumanCheck.fields,
    }
    render :new, status: status || (errors.any? ? :unprocessable_entity : :ok)
  end
end
