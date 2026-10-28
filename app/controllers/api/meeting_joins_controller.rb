# Clicking Join on a meeting (entrypoints/toasts.jsx sends it from any Join button that carries
# data-meeting-join). In the half hour before the meeting starts it counts toward that meeting's
# Meeting Maker chips, once it starts (MeetingJoin, Chips.meeting_chips).
class Api::MeetingJoinsController < ApplicationController
  before_action :authenticate_user!

  # POST /api/meeting_joins { meeting_id } -> { counted, starts_at }
  def create
    meeting = Meeting.includes(:group).find_by(id: params[:meeting_id])
    return render(json: { error: "Not found." }, status: :not_found) unless meeting&.group&.page_visible_to?(current_user)

    start = MeetingJoin.start_for(meeting)
    return render(json: { counted: false }) unless start

    MeetingJoin.find_or_create_by!(user: current_user, meeting: meeting, starts_at: start)
    render json: { counted: true, starts_at: start.iso8601 }
  rescue ActiveRecord::RecordNotUnique
    render json: { counted: true, starts_at: start.iso8601 }
  end
end
