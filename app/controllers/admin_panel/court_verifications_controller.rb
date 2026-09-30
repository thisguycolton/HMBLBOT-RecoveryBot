# Court attendance verifications lookup (User#court_verification_admin? only). index is a React app
# (entrypoints/court_verifications_admin.jsx) backed by Api::Admin::CourtVerificationsController;
# print renders every match as letters, one per page, to print or save as a PDF.
module AdminPanel
  class CourtVerificationsController < ApplicationController
    before_action :authenticate_user!
    before_action -> { redirect_to root_path, alert: "Access denied!" unless current_user.court_verification_admin? }

    layout "reader", only: :index

    def index; end

    def print
      @court_verifications = CourtVerification.filtered(**params.permit(:name, :email, :from, :to).to_h.symbolize_keys)
                                              .order(:meeting_at)
                                              .limit(Api::Admin::CourtVerificationsController::BUNDLE_LIMIT)
      render layout: false
    end
  end
end
