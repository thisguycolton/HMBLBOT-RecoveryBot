# The Hosting Command Center (app/services/hosting_center.rb): the tools a meeting's host and
# co-host run it with, for the members who can host (Group#can_host?). Host coordinators
# (Group#hosts_editable_by?) set up each meeting's kit, or the group's default one. The page
# checks in every few seconds (ping), which is how the host and co-host see each other.
class Api::GroupHostingController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_host
  before_action :set_meeting, except: :index
  before_action :require_coordinator, only: %i[kit reset_kit]

  # GET /api/groups/:group_slug/hosting
  def index
    render json: { meetings: HostingCenter.meetings_json(@group, current_user), can_edit: @group.hosts_editable_by?(current_user) }
  end

  # GET /api/groups/:group_slug/hosting/:meeting_id
  def show
    render json: center
  end

  # POST /api/groups/:group_slug/hosting/:meeting_id/ping { activity, section_index }
  def ping
    presence = hosting_session.presences.find_or_initialize_by(user: current_user)
    presence.update!(activity: params[:activity], section_index: params[:section_index].presence&.to_i, last_seen_at: Time.current)
    render json: hosting_session.live_json(current_user)
  end

  # POST /api/groups/:group_slug/hosting/:meeting_id/act { act, index, label, posting_id, activity, number }
  def act
    act = params[:act].to_s
    return render(json: { error: "That isn't something the Command Center does." }, status: :unprocessable_entity) unless HostingSession::ACTS.include?(act)

    if act.in?(%w[posted unposted])
      posting = center.kit&.postings&.find_by(id: params[:posting_id])
      return render(json: { error: "Not found." }, status: :not_found) unless posting
    end

    pick = params[:activity].respond_to?(:permit) ? params[:activity].permit(:kind, :title, :note, :book_slug, :chapter_slug, :book_title, :topic_set_id, :topic_set_name).to_h : nil
    hosting_session.act!(act, user: current_user, index: params[:index], label: params[:label], posting: posting, pick: pick,
                              topic: (draw_topic(params[:number]) if act == "draw_topic"))
    render json: hosting_session.live_json(current_user)
  end

  # PUT /api/groups/:group_slug/hosting/:meeting_id/kit
  # { kit: { scope: "meeting" | "default", script_document_id, activity_anchor, readings: [...], postings: [{ id, title, icon, minute, body }] } }
  def kit
    attrs = params.require(:kit)
    kit = if attrs[:scope] == "default"
            @group.hosting_kits.find_or_initialize_by(meeting_id: nil)
          else
            @group.hosting_kits.find_by(meeting_id: @meeting.series.select(:id)) || @group.hosting_kits.new(meeting: @meeting)
          end
    HostingKit.transaction do
      kit.script_document_id = attrs[:script_document_id].presence
      kit.activity_anchor = attrs[:activity_anchor] if attrs.key?(:activity_anchor)
      kit.readings = attrs.permit(readings: %i[book_slug chapter_slug title book_title url]).fetch(:readings, []).map(&:to_h)
      kit.save!
      sync_postings(kit, attrs.permit(postings: %i[id title icon minute body]).fetch(:postings, []))
    end
    render json: HostingCenter.new(@group, @meeting, current_user).as_json
  rescue ActiveRecord::RecordInvalid => e
    render_errors(e.record)
  end

  # DELETE /api/groups/:group_slug/hosting/:meeting_id/kit: this meeting goes back to the group's default
  def reset_kit
    @group.hosting_kits.where(meeting_id: @meeting.series.select(:id)).destroy_all
    render json: HostingCenter.new(@group, @meeting, current_user).as_json
  end

  private

  def require_host
    return if @group.can_host?(current_user)

    render json: { error: "The Hosting Command Center is for the members who host this group's meetings." }, status: :forbidden
  end

  def require_coordinator
    return if @group.hosts_editable_by?(current_user)

    render json: { error: "Only host coordinators can change what hosts get." }, status: :forbidden
  end

  def set_meeting
    @meeting = @group.meetings.find(params[:meeting_id] || params[:id])
  end

  def center = @center ||= HostingCenter.new(@group, @meeting, current_user)
  def hosting_session = center.session

  # A topic from the activity's Topicificator set: by its number, or at random among the ones not
  # drawn yet today
  def draw_topic(number)
    activity = hosting_session.activity || {}
    topics = Topic.where(topic_set_id: activity["topic_set_id"])
    return topics.find_by(searchable_number: number.to_s.strip) if number.present?

    drawn = Array(activity["topics"]).map { |t| t["id"] }
    topics.where.not(id: drawn).order(Arel.sql("RANDOM()")).first || topics.order(Arel.sql("RANDOM()")).first
  end

  # The postings in the order given: kept by id, new ones added, the ones left out removed
  def sync_postings(kit, list)
    keep = []
    list.each_with_index do |p, i|
      posting = (p[:id].present? && kit.postings.find_by(id: p[:id])) || kit.postings.new
      posting.assign_attributes(title: p[:title], icon: p[:icon], minute: p[:minute].to_i, body: p[:body], position: i)
      posting.save!
      keep << posting.id
    end
    kit.postings.where.not(id: keep).delete_all
  end
end
