# The page that holds the polls React app (app/javascript/entrypoints/polls.jsx). A poll's own
# page (/p/:token or /polls/:token) is public so anyone with the link can open it; the list,
# new and edit pages need an account.
class PollsController < ApplicationController
  layout "reader"

  def app
    public_poll = params[:token].present? && params[:token] != "new" && params[:path].blank?
    authenticate_user! unless public_poll

    @poll = Poll.find_by(token: params[:token]) if public_poll
    if @poll
      # Signing in from the poll comes back to it
      store_location_for(:user, request.fullpath) unless user_signed_in?
      @share = ShareMeta.safely do
        ShareMeta.site(title: @poll.question.truncate(90), description: "Vote in this poll on RecoveryBot.", path: @poll.short_path)
      end
    end
  end
end
