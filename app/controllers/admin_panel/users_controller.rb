# app/controllers/admin_panel/users_controller.rb
module AdminPanel
  class UsersController < ApplicationController
    before_action :authenticate_user!
    before_action :admin_only

    def index
      @unconfirmed_users = User.where(confirmed: false)
    end

    def confirm
      user = User.find(params[:id])
      user.update(confirmed: true)
      redirect_to admin_panel_users_path, notice: "User #{user.email} has been confirmed."
    end

    private

    def admin_only
      redirect_to root_path, alert: "Access denied!" unless current_user.admin?
    end
  end
end
