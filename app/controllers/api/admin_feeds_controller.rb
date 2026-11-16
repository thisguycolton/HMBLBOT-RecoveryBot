# The sidebar's "Everyone's posts" switch, for site admins only (User#suite_admin?): their home
# feed shows what every member shared with Followers or Members, not only the people they follow
# (ProfilePage#everyone_feed). Private notes and highlights ("Only me") stay hidden either way.
class Api::AdminFeedsController < ApplicationController
  before_action :authenticate_user!
  before_action { render(json: { error: "Site admins only" }, status: :forbidden) unless current_user.suite_admin? }

  # PUT /api/admin_feed { all: true|false }
  def update
    current_user.update_column(:see_all_posts, ActiveModel::Type::Boolean.new.cast(params[:all]) || false)
    render json: { see_all_posts: current_user.see_all_posts }
  end
end
