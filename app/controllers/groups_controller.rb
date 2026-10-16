# The page that holds the Groups React app (app/javascript/entrypoints/groups.jsx), and
# invite links. Groups is admin-only for now; see Group.feature_open_to?.
class GroupsController < ApplicationController
  layout "reader"
  before_action :authenticate_user!, except: :join
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  def app
    return if Group.feature_open_to?(current_user) || current_user.group_memberships.exists?

    redirect_to root_path, alert: "Groups isn't open yet."
  end

  # GET /groups/join/:token -> join now, or after signing in (the token waits in a cookie)
  def join
    group = Group.find_by(join_token: params[:token].to_s)
    return redirect_to(root_path, alert: "That invite link doesn't work anymore. Ask the group for a new one.") unless group

    unless user_signed_in?
      cookies.signed[:group_invite] = { value: group.join_token, expires: 30.days, httponly: true }
      return redirect_to(new_user_registration_path, notice: "Make an account (or log in) to join #{group.title}.")
    end

    JoinsGroupFromInvite.call(current_user, group.join_token)
    redirect_to "/groups/#{group.slug}", notice: "Welcome to #{group.title}."
  end
end
