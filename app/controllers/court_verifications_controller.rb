# app/controllers/court_verifications_controller.rb
class CourtVerificationsController < ApplicationController
  # you can add before_action :authenticate_user! if needed
  layout "reader", only: %i[new]
  # Not linked from anywhere public: hosts share the URL directly, and search engines are told to skip it
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }


  def new
  end
end
