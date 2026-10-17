# app/controllers/api/court_verifications_controller.rb
module Api
  class CourtVerificationsController < ApplicationController
    # You’re already sending the CSRF token via axios, so this may not be needed,
    # but if you run into CSRF issues uncomment the next line:
    # protect_from_forgery with: :null_session

    def create
      @court_verification = CourtVerification.new(court_verification_params)
      assign_group_meeting if params[:group_slug].present?

      if @court_verification.save
        # Kick off email here (if you’ve built the mailer)
        CourtVerificationMailer.with(court_verification: @court_verification)
                                .verification_email
                                .deliver_later

        render json: { message: "Verification created" }, status: :created
      else
        render json: { errors: @court_verification.errors.full_messages },
               status: :unprocessable_entity
      end
    end

    private

    # From a group's form: the meeting it picked on the given day, timed in the meeting's zone
    def assign_group_meeting
      group = Group.active.find_by(slug: params[:group_slug].to_s)
      meeting = group&.meetings&.find_by(id: params[:meeting_id])
      date = Date.iso8601(params[:meeting_date].to_s) rescue nil
      @court_verification.group = group
      @court_verification.meeting = meeting
      @court_verification.meeting_at = meeting && date && meeting.start_on(date)
    end

    def court_verification_params
      params.require(:court_verification).permit(
        :respondent_name,
        :respondent_email,
        :meeting_at,
        :host_name,
        :signer_name,
        :topic
      )
    end
  end
end
