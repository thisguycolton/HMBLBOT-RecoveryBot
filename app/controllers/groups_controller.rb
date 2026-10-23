# The page that holds the Groups React app (app/javascript/entrypoints/groups.jsx), and
# invite links. Groups is admin-only for now (see Group.feature_open_to?), except Find a
# meeting and the group pages it opens, which need no account (PUBLIC_PATHS).
class GroupsController < ApplicationController
  layout "reader"
  # /groups/meetings, /groups/find/<listing>, /groups/<slug> and its public tabs, and the
  # group's documents and decisions (the API only gives a visitor the Public ones), and the chat
  # postings a hosting short link opens (/h/:code)
  PUBLIC_PATHS = %r{\A(meetings|find/[^/]+|[a-z0-9-]+/chat/[A-Za-z0-9]+|(?!(new|find|default-page)\z)[a-z0-9-]+(/(home|meetings|events)|/meetings/\d+|/conscience(/documents(/\d+)?|/decisions)?)?)\z}

  before_action :authenticate_user!, except: %i[app join ask]
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }

  def app
    @share = ShareMeta.safely { share_for(params[:path].to_s) }
    return if user_signed_in? && (Group.feature_open_to?(current_user) || current_user.group_memberships.exists?)
    return if PUBLIC_PATHS.match?(params[:path].to_s)
    return authenticate_user! unless user_signed_in?

    redirect_to root_path, alert: "Groups isn't open yet."
  end

  # The link preview (ShareMeta) for a page anyone may open: a group, one of its meetings, a
  # Public document, an AA Intergroup listing, or Find a meeting
  def share_for(path)
    case path
    when "", "find" then nil
    when "meetings"
      ShareMeta.site(title: "Find a meeting", description: "AA meetings from AA Intergroup and RecoveryBot's groups, at times in your time zone.", path: "/groups/meetings")
    when %r{\Afind/([^/]+)\z}
      (listing = OiaaMeeting.listed.find_by(slug: CGI.unescape(Regexp.last_match(1)))) && ShareMeta.listing(listing)
    when %r{\A([a-z0-9-]+)(?:/(.*))?\z}
      group = Group.find_by(slug: Regexp.last_match(1)) or return
      rest = Regexp.last_match(2).to_s
      record = case rest
               when %r{\Aconscience/documents/(\d+)\z} then group.documents.find_by(id: Regexp.last_match(1))
               when %r{\Ameetings/(\d+)\z} then group.meetings.find_by(id: Regexp.last_match(1))
               end
      (record && ShareMeta.for(record)) || ShareMeta.group(group)
    end
  end

  # GET /groups/:slug/ask -> "Ask to join" from someone signed out: make an account (or log
  # in), then back to the group's page, which sends the request (?ask=1). New accounts wait
  # for an admin to confirm them, so the group waits in a cookie like an invite does.
  def ask
    group = Group.find_by(slug: params[:slug].to_s)
    return redirect_to("/groups/meetings", alert: "That group isn't here.") unless group&.page_visible_to?(current_user)

    back = "/groups/#{group.slug}?ask=1"
    return redirect_to(back) if user_signed_in?

    cookies.signed[:group_ask] = { value: group.slug, expires: 30.days, httponly: true }
    redirect_to new_user_registration_path, notice: "Make an account (or log in) to ask to join #{group.title}."
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
