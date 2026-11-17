# GET /meeting_maps/:kind/:id.png -> the little map of where an in-person meeting is
# (MeetingMap): a group's meeting (kind "meeting", to whoever may see the group's page) or a
# meeting list's listing ("listing", to anyone). 404 when it has no place we can find.
class MeetingMapsController < ApplicationController
  skip_after_action :track_action, raise: false

  def show
    record = find_record
    map = MeetingMap.for(record) or return head(:not_found)

    expires_in 1.day, public: record.is_a?(OiaaMeeting)
    send_file map.path, type: "image/png", disposition: "inline"
  rescue ActiveRecord::RecordNotFound
    head :not_found
  rescue MeetingMap::Failed => e
    Rails.logger.warn("[map] #{e.message}")
    head :service_unavailable
  end

  private

  def find_record
    case params[:kind]
    when "meeting"
      meeting = Meeting.includes(:group).find(params[:id])
      raise ActiveRecord::RecordNotFound unless meeting.group.page_visible_to?(current_user)
      meeting
    when "listing" then OiaaMeeting.listed.find_by!(slug: params[:id])
    end
  end
end
