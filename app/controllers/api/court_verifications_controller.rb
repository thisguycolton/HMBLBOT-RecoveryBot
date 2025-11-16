# app/controllers/api/court_verifications_controller.rb
module Api
  class CourtVerificationsController < ApplicationController
    # You’re already sending the CSRF token via axios, so this may not be needed,
    # but if you run into CSRF issues uncomment the next line:
    # protect_from_forgery with: :null_session

    def create
      @court_verification = CourtVerification.new(court_verification_params)

      if @court_verification.save
        # Kick off email here (if you’ve built the mailer)
        # CourtVerificationMailer.with(court_verification: @court_verification)
        #                         .verification_email
        #                         .deliver_later

        render json: { message: "Verification created" }, status: :created
      else
        render json: { errors: @court_verification.errors.full_messages },
               status: :unprocessable_entity
      end
    end

    private

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
