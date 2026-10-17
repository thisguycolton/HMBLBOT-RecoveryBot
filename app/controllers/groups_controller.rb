# The page that holds the Groups React app (app/javascript/entrypoints/groups.jsx), and
# invite links. Finding a meeting and looking at a group need no account (PUBLIC_PATHS);
# the rest of Groups is admin-only for now (Group.feature_open_to?).
class GroupsController < ApplicationController
  layout "reader"
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  # Find a meeting, Find your group, an AA Intergroup group's page, and a group's own page
  # (its Home, Meetings and Events tabs)
  RESERVED = Group::RESERVED_SLUGS.join("|")
  PUBLIC_PATHS = %r{\A(meetings|find(/[^/]+)?|(?!(#{RESERVED})(/|\z))[^/]+(/(home|meetings|events))?)\z}

  def app
    return if public_path?
    return authenticate_user! unless user_signed_in?
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

  # GET /groups/:slug/ask_to_join -> "Ask to join" while signed out: make an account (or
  # log in) first; the request is sent when they sign in (ApplicationController#after_sign_in_path_for)
  def ask_to_join
    group = Group.find_by(slug: params[:slug].to_s)
    return redirect_to("/groups/meetings", alert: "That group isn't here anymore.") unless group&.viewable_by?(current_user)
    return redirect_to("/groups/#{group.slug}") if user_signed_in?

    cookies.signed[:group_request] = { value: group.slug, expires: 30.days, httponly: true }
    redirect_to new_user_registration_path, notice: "Make an account (or log in) to ask to join #{group.title}. We'll send your request when you sign in."
  end

  private

  def public_path?
    PUBLIC_PATHS.match?(params[:path].to_s)
  end
end
