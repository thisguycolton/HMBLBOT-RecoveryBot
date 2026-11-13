# /testflight: a short form to ask to test the app before it's in the stores, on an iPhone
# (Apple's TestFlight) or Android (Google Play's closed test). /testflight?platform=android picks
# Android to start with, and so does visiting from an Android phone. Saves a TestflightRequest
# (Site Admin > Tester requests, site admins get a notification), with
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
    unless TestflightRequest.pending_for(attrs[:email], attrs[:platform])
      testflight_request = TestflightRequest.new(attrs.merge(user: current_user))
      return show_form(*testflight_request.errors.map { |e| error_message(e) }) unless testflight_request.save
    end
    redirect_to testflight_path(sent: 1, platform: attrs[:platform] == "android" ? "android" : nil)
  end

  private

  def form
    @form ||= params.fetch(:testflight, {}).permit(:name, :email, :note, :platform).tap do |f|
      f[:platform] = platform_from(f[:platform])
    end
  end

  # The app asked for: the form's choice, else ?platform=, else an Android phone's own, else iPhone
  def platform_from(chosen)
    return chosen if TestflightRequest::PLATFORMS.include?(chosen)
    return params[:platform] if TestflightRequest::PLATFORMS.include?(params[:platform])

    request.user_agent.to_s.include?("Android") ? "android" : "ios"
  end

  def error_message(error)
    case error.attribute
    when :name then error.type == :blank ? "Please add your name." : "Please keep your name under 100 characters."
    when :email then form[:platform] == "android" ? "Please add the email address of your Google account." : "Please add the email address you use for your Apple ID."
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
        platform: form[:platform],
      },
      human_check: HumanCheck.fields,
    }
    render :new, status: status || (errors.any? ? :unprocessable_entity : :ok)
  end
end
