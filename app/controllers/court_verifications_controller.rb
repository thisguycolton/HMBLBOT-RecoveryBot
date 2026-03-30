# app/controllers/court_verifications_controller.rb
class CourtVerificationsController < ApplicationController
  # you can add before_action :authenticate_user! if needed
  layout "reader", only: %i[new]


  def new
  end
end
