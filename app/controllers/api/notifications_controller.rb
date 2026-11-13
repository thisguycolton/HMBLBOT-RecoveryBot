# The signed-in account's notification center (the bell in the nav).
class Api::NotificationsController < ApplicationController
  before_action :authenticate_user!

  LIMIT = 30

  # GET /api/notifications -> { unread, notifications: [...] } (newest first)
  def index
    rows = current_user.notifications.recent.limit(LIMIT)
    render json: { unread: current_user.notifications.unread.count, notifications: rows.map(&:as_api_json) }
  end

  # POST /api/notifications/:id/read
  def read
    current_user.notifications.find(params[:id]).update!(read_at: Time.current)
    head :no_content
  end

  # POST /api/notifications/read_all
  def read_all
    current_user.notifications.unread.update_all(read_at: Time.current)
    head :no_content
  end

  # DELETE /api/notifications/:id (the x on one in the panel)
  def destroy
    current_user.notifications.find(params[:id]).destroy!
    head :no_content
  end

  # DELETE /api/notifications/clear (Clear all)
  def clear
    Notification.where(user_id: current_user.id).delete_all
    head :no_content
  end
end
