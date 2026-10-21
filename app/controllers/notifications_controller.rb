# Where tapping a push notification goes (Notification#open_path): marks it read, then on to
# the page it's about. Only the site's own paths, so it can't send anyone elsewhere.
class NotificationsController < ApplicationController
  before_action :authenticate_user!

  # GET /notifications/:id/open
  def open
    notification = current_user.notifications.find(params[:id])
    notification.update!(read_at: Time.current) unless notification.read?
    url = notification.url.to_s
    redirect_to(url.match?(%r{\A/(?![/\\])}) ? url : "/")
  end
end
