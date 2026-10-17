# Pages in the admin suite: signed in, and User#suite_admin?
module AdminSuiteAccess
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_user!
    before_action -> { redirect_to root_path, alert: "Access denied!" unless current_user.suite_admin? }
  end
end
