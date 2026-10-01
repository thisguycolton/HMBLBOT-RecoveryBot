# Base for the admin suite's JSON APIs (AdminPanel::SuiteController). Stricter than the
# Topicificator admin's: see User#suite_admin?
class Api::Admin::SuiteController < Api::Admin::BaseController
  before_action -> { render json: { error: "Admins only" }, status: :forbidden unless current_user&.suite_admin? }
end
