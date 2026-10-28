# Clearing a "Needs your attention" item from Today, and putting it back (TodayDuties#json lists
# the cleared ones).
class Api::TodayDismissalsController < ApplicationController
  before_action :authenticate_user!

  # POST /api/today_dismissals { key, title }
  def create
    return head(:unprocessable_entity) if params[:key].blank? || params[:title].blank?

    TodayDismissal.clear!(current_user, key: params[:key].to_s, title: params[:title].to_s)
    head :no_content
  end

  # DELETE /api/today_dismissals?key=sub-12 (restore)
  def destroy
    current_user.today_dismissals.where(key: params[:key].to_s).delete_all
    head :no_content
  end
end
