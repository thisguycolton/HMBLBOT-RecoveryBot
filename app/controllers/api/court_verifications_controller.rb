module Api
  class CourtVerificationsController < ApplicationController
    protect_from_forgery with: :null_session, if: -> { request.format.json? }

    def create
      @court_verification = CourtVerification.new(court_verification_params)

      if @court_verification.save
        # Use deliver_later if you have ActiveJob/queue set up
        CourtVerificationMailer.verification_email(@court_verification).deliver_later

        render json: {
          id: @court_verification.id,
          message: "Verification email sent."
        }, status: :created
      else
        render json: { errors: @court_verification.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def court_verification_params
      params.require(:court_verification).permit(
        :respondent_name,
        :respondent_email,
        :meeting_at,
        :host_name
      )
    end
  end
end
