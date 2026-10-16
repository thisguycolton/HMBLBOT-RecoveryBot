# A group's meetings (group admins). Meetings linked to OIAA take their details from the
# directory; see app/models/meeting.rb and app/services/oiaa_feed.rb.
class Api::GroupMeetingsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_manager
  before_action :set_meeting, only: %i[update destroy unlink]

  # POST /api/groups/:slug/meetings { meeting: {...}, days: [1, 3, 5]?, oiaa_slug? }
  # A weekly meeting on several days is one meeting per day. With oiaa_slug, it's linked to
  # that OIAA listing and takes its details (and its days); notes and place are kept.
  def create
    attrs = meeting_params
    meetings =
      if params[:oiaa_slug].present?
        record = OiaaMeeting.find_by!(slug: params[:oiaa_slug])
        record.days.reject { |d| @group.meetings.exists?(oiaa_slug: record.slug, day_of_week: d) }.map do |day|
          @group.meetings.new(attrs.slice(:notes, :location, :formatted_address)).apply_oiaa(record, day: day)
        end
      elsif attrs[:recurrence] != "once" && params[:days].is_a?(Array) && params[:days].any?
        params[:days].map(&:to_i).uniq.map { |day| @group.meetings.new(attrs.merge(day_of_week: day)) }
      else
        [@group.meetings.new(attrs)]
      end
    return render(json: { error: "That listing is already one of this group's meetings." }, status: :unprocessable_entity) if meetings.empty?

    invalid = meetings.find(&:invalid?)
    return render_errors(invalid) if invalid

    Meeting.transaction { meetings.each(&:save!) }
    render json: meetings.first.as_api_json.merge(created: meetings.size), status: :created
  end

  # PATCH /api/groups/:slug/meetings/:id. On a linked meeting only the local fields change
  # (notes, location), unless oiaa_slug links it to a listing.
  def update
    if params[:oiaa_slug].present?
      @meeting.apply_oiaa(OiaaMeeting.find_by!(slug: params[:oiaa_slug]), day: params[:oiaa_day].presence&.to_i)
      @meeting.assign_attributes(meeting_params.slice(:notes, :location, :formatted_address))
    elsif @meeting.oiaa_linked?
      @meeting.assign_attributes(meeting_params.slice(:notes, :location, :formatted_address))
    else
      @meeting.assign_attributes(meeting_params)
    end
    @meeting.save ? render(json: @meeting.as_api_json) : render_errors(@meeting)
  end

  # DELETE /api/groups/:slug/meetings/:id
  def destroy
    @meeting.destroy!
    head :no_content
  end

  # POST /api/groups/:slug/meetings/:id/unlink -> stop following OIAA; edit it by hand
  def unlink
    @meeting.unlink_oiaa.save!
    render json: @meeting.as_api_json
  end

  # POST /api/groups/:slug/meetings/import { slugs: [...] } -> one weekly meeting per day listed
  def import
    records = OiaaMeeting.listed.where(slug: Array(params[:slugs]).first(50))
    created = 0
    Meeting.transaction do
      records.each do |record|
        record.days.each do |day|
          next if @group.meetings.exists?(oiaa_slug: record.slug, day_of_week: day)

          @group.meetings.new.apply_oiaa(record, day: day).save!
          created += 1
        end
      end
    end
    render json: { created: created, meetings: @group.meetings.ordered.map(&:as_api_json) }
  end

  # POST /api/groups/:slug/meetings/refresh -> fetch OIAA now and update linked meetings
  def refresh
    OiaaFeed.sync!
    render json: { meetings: @group.meetings.reload.ordered.map(&:as_api_json), oiaa_synced_at: OiaaFeed.last_synced_at&.iso8601 }
  rescue OiaaFeed::Error, SocketError, SystemCallError, Net::OpenTimeout, Net::ReadTimeout, JSON::ParserError, OpenSSL::SSL::SSLError => e
    render json: { error: "Couldn't reach Meeting Guide: #{e.message}" }, status: :bad_gateway
  end

  private

  def set_meeting
    @meeting = @group.meetings.find(params[:id])
  end

  def meeting_params
    attrs = params.require(:meeting).permit(:name, :recurrence, :day_of_week, :start_minute, :end_minute, :starts_at, :ends_at,
                                            :time_zone, :conference_url, :conference_url_notes, :conference_phone,
                                            :location, :formatted_address, :notes, types: [])
    # starts_at/ends_at come as wall-clock "2026-10-20T07:00" in the meeting's zone
    zone = ActiveSupport::TimeZone[attrs[:time_zone].presence || @meeting&.time_zone || @group.time_zone]
    %i[starts_at ends_at].each { |k| attrs[k] = attrs[k].present? ? zone.parse(attrs[k]) : nil if attrs.key?(k) }
    attrs
  end
end
