# Development only (the routes aren't even defined elsewhere): become any user in one click,
# to set up demo videos. /dev/users lists the people `bin/rails demo:seed` made, by group.
module Dev
  class LoginsController < ApplicationController
    before_action { head :not_found unless Rails.env.development? }

    def index
      @groups = Group.order(:title).includes(memberships: { user: { avatar_attachment: :blob } })
      @others = User.where.not(id: GroupMembership.select(:user_id)).order(:name)
      render layout: false
    end

    def create
      user = User.find_by!(username: params[:username])
      sign_out(:user)
      sign_in(:user, user)
      redirect_to(safe_path(params[:to]) || after_sign_in_path_for(user))
    end

    def destroy
      sign_out(:user)
      redirect_to "/dev/users"
    end

    private

    def safe_path(path) = path.to_s.start_with?("/") && !path.to_s.start_with?("//") ? path : nil
  end
end
