# app/controllers/court_verifications_controller.rb
class CourtVerificationsController < ApplicationController
  include KeepsRobotsOut
  # Reached only by a direct link from the host, never from the site's menus, so keep it out of search too.
  keep_robots_out

  # you can add before_action :authenticate_user! if needed
  layout "reader", only: %i[new]


  def new
  end
end
