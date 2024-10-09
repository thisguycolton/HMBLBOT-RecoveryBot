class UserActiveGroupsController < ApplicationController
  def create

    @user_active_group = UserActiveGroup.new(user_active_group_params)
    @user_active_group.user = User.find(current_user.id)
      if @user_active_group.save
        redirect_to root_path
      else

      end
  end

  def update
  end

  private

  def user_active_group_params
      params.require(:user_active_group).permit(:user, :group, :group_id)
  end
end
