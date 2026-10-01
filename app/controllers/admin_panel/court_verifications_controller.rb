# Court verifications as letters, one per page, to print or save as a PDF. The lookup itself
# is a page of the admin suite (AdminPanel::SuiteController).
module AdminPanel
  class CourtVerificationsController < ApplicationController
    include AdminSuiteAccess

    def print
      @court_verifications = CourtVerification.filtered(**params.permit(:name, :email, :from, :to).to_h.symbolize_keys)
                                              .order(:meeting_at)
                                              .limit(Api::Admin::CourtVerificationsController::BUNDLE_LIMIT)
      render layout: false
    end
  end
end
