# The page that holds the schedule polls React app. The poll page itself is public so
# anyone with the link can vote; the list, new and edit pages need an account.
class SchedulePollsController < ApplicationController
  layout "reader"

  def app
    public_poll = params[:token].present? && params[:token] != "new" && params[:path].blank?
    authenticate_user! unless public_poll
    @poll = SchedulePoll.find_by(token: params[:token]) if public_poll
  end
end
