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

  # POST /api/groups/:group_slug/hosting/:meeting_id/act { act, index, label, posting_id, activity, number, data }
  def act
    act = params[:act].to_s
    return render(json: { error: "That isn't something the Command Center does." }, status: :unprocessable_entity) unless HostingSession::ACTS.include?(act)

    if act.in?(%w[posted unposted])
      posting = posted_posting(params[:posting_id])
      return render(json: { error: "Not found." }, status: :not_found) unless posting
    end

    pick = params[:activity].respond_to?(:permit) ? params[:activity].permit(:kind, :title, :note, :book_slug, :chapter_slug, :book_title, :topic_set_id, :topic_set_name, :reading_id).to_h : nil
    if act == "activity" && pick&.dig("kind") == "my_reading"
      reading = current_user.readings.find_by(id: pick["reading_id"])
      return render(json: { error: "That isn't one of your readings." }, status: :unprocessable_entity) unless reading

      pick = my_reading_pick(reading)
    end
    data = params[:data].respond_to?(:permit) ? params[:data].permit(:value, :id, :name, :length, :done, :by).to_h : {}
    hosting_session.act!(act, user: current_user, index: params[:index], label: params[:label], posting: posting, pick: pick, data: data,
                              topic: (draw_topic(params[:number]) if act == "draw_topic"))
    render json: hosting_session.live_json(current_user)
  end

  # GET /api/groups/:group_slug/hosting/:meeting_id/my_readings: the viewer's own readings, to pick today's from
  def my_readings
    readings = current_user.readings.order(updated_at: :desc).limit(200).map do |r|
      { id: r.id, title: r.title.to_s, meeting_name: r.meetingName.presence, status: r.draft? ? "draft" : r.scheduled_for_later? ? "scheduled" : "published" }
    end
    render json: { readings: readings }
  end

  # GET /api/groups/:group_slug/hosting/:meeting_id/reading: the reading the hosts picked for this
  # date, whoever owns it, so both hosts can read it here even when it's still a draft
  def reading
    activity = hosting_session.activity
    picked = Reading.find_by(id: activity["reading_id"]) if activity&.dig("kind") == "my_reading"
    return render(json: { error: "No reading of the hosts' own is picked for today." }, status: :not_found) unless picked

    render json: reading_json(picked)
  end

  # PUT /api/groups/:group_slug/hosting/:meeting_id/kit
  # { kit: { scope: "meeting" | "default", script_document_id, activity_anchor, public_postings, service_roles: [{ key, label }], readings: [...], postings: [{ id, title, icon, minute, body }] } }
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
      kit.public_postings = ActiveModel::Type::Boolean.new.cast(attrs[:public_postings]) if attrs.key?(:public_postings)
      kit.service_roles = attrs.permit(service_roles: %i[key label]).fetch(:service_roles, []).map(&:to_h) if attrs.key?(:service_roles)
      kit.readings = attrs.permit(readings: %i[book_slug chapter_slug title book_title url]).fetch(:readings, []).map(&:to_h)
      kit.save!
      sync_postings(kit, attrs.permit(postings: %i[id title icon minute body]).fetch(:postings, []))
    end
    render json: center.as_json
  rescue ActiveRecord::RecordInvalid => e
    render_errors(e.record)
  end

  # DELETE /api/groups/:group_slug/hosting/:meeting_id/kit: this meeting goes back to the group's default
  def reset_kit
    @group.hosting_kits.where(meeting_id: @meeting.series.select(:id)).destroy_all
    render json: center.as_json
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

  # What "copied" is recorded against: one of the kit's chat postings, or the posting that comes with a
  # reading the hosts picked from their own (it isn't a HostChatPosting)
  def posted_posting(id)
    if id.to_s == HostingSession::POSTED_READING
      title = hosting_session.activity&.dig("kind") == "my_reading" ? "the reading" : nil
      Struct.new(:id, :title).new(id, title) if title
    else
      center.kit&.postings&.find_by(id: id)
    end
  end

  # The reading's text as HTML (its rich text, else the newer editor's, which is HTML or Tiptap JSON)
  # and its example topics
  def reading_json(picked)
    richer = picked.richer_content&.body.to_s.strip
    tiptap = (JSON.parse(richer) rescue nil) if richer.start_with?("{")
    html = picked.content.to_s.presence || (ActionController::Base.helpers.sanitize(richer).presence unless tiptap)
    { title: picked.title.to_s, source: picked.source.presence, html: html, tiptap: (tiptap unless html), topics_html: picked.topic.to_s.presence }
  end

  # A reading the viewer owns as the day's activity: what its page copies (the title, its link and
  # the example topics as plain lines) kept with it, so the chat posting needs nothing else
  def my_reading_pick(reading)
    { "kind" => "my_reading", "reading_id" => reading.id, "title" => reading.title.to_s, "reading_path" => Rails.application.routes.url_helpers.reading_path(reading),
      "reading_topics" => topics_text(reading.topic.to_s), "reading_published" => reading.published? }
  end

  # The topics' HTML as the reading's page copies it: one line each, "- " before list items
  def topics_text(html)
    text = html.gsub(%r{</(li|p|div|h[1-6])>|<br\s*/?>}i, "\n").gsub(/<li[^>]*>/i, "- ")
    CGI.unescapeHTML(ActionController::Base.helpers.strip_tags(text)).tr("\u00a0", " ").lines.map(&:strip).join("\n").gsub(/\n{3,}/, "\n\n").strip
  end

  def center = @center ||= HostingCenter.new(@group, @meeting, current_user, on: requested_on)

  # ?on=2026-10-20: the date a short link opened (/h/CODE), so both hosts stay on it
  def requested_on
    Date.iso8601(params[:on].to_s) if params[:on].present?
  rescue Date::Error
    nil
  end
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
