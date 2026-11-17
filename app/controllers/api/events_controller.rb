# Events (app/models/event.rb), behind the event page and the HMBLBOT Editor
# (app/javascript/entrypoints/events.jsx). A published event is public to anyone with the
# link; everything that changes it needs one of its editors.
class Api::EventsController < ApplicationController
  before_action :authenticate_user!, except: %i[show rsvp unrsvp]
  before_action :set_event
  before_action :require_editor, only: %i[update images people poll_options link_poll unlink_poll]
  before_action :require_manager, only: %i[destroy add_collaborator remove_collaborator]

  # GET /api/events/:token
  def show
    render json: event_json
  end

  # PATCH /api/events/:token (multipart when a cover or flyer comes along)
  # event: title, short_description, layout, status, time_zone, starts_at, ends_at, location,
  # blocks (JSON string or array), cover, flyer, remove_cover, remove_flyer
  def update
    attrs = params.require(:event).permit(:title, :short_description, :layout, :status, :time_zone, :location, :cover, :flyer)
    before = @event.blocks
    @event.assign_attributes(attrs.except(:cover, :flyer))
    @event.cover = attrs[:cover] if attrs[:cover].present?
    @event.flyer = attrs[:flyer] if attrs[:flyer].present?
    @event.blocks = parse_blocks(params[:event][:blocks]) if params[:event].key?(:blocks)
    zone = ActiveSupport::TimeZone[@event.time_zone] || Time.zone
    %i[starts_at ends_at].each do |field|
      @event[field] = params[:event][field].present? ? zone.parse(params[:event][field].to_s) : nil if params[:event].key?(field)
    end
    return render_errors(@event) unless @event.save

    @event.cover.purge_later if truthy(params[:event][:remove_cover]) && attrs[:cover].blank?
    @event.flyer.purge_later if truthy(params[:event][:remove_flyer]) && attrs[:flyer].blank?
    link_block_polls
    sent = @event.announce_changes(before, by: current_user)
    render json: event_json.merge(sent_updates: sent.map(&:as_api_json))
  end

  # DELETE /api/events/:token (group admins)
  def destroy
    @event.destroy!
    head :no_content
  end

  # POST /api/events/:token/images { file } -> { url } for a picture in a block
  def images
    file = params[:file]
    unless file.respond_to?(:content_type) && Event::IMAGE_TYPES.include?(file.content_type)
      return render(json: { error: "Pictures need to be JPEG, PNG, WebP or GIF." }, status: :unprocessable_entity)
    end
    return render(json: { error: "Pictures need to be under 10 MB." }, status: :unprocessable_entity) if file.size > 10.megabytes

    blob = ActiveStorage::Blob.create_and_upload!(io: file, filename: file.original_filename, content_type: file.content_type)
    @event.images.attach(blob)
    render json: { url: Rails.application.routes.url_helpers.rails_storage_proxy_path(blob, only_path: true) }, status: :created
  end

  # GET /api/events/:token/people?q= -> members of the group to add as collaborators
  # (group admins) or, for anyone editing, to see who's who
  def people
    q = "%#{User.sanitize_sql_like(params[:q].to_s.strip)}%"
    taken = @event.collaborators.pluck(:user_id) + @event.group.admins.pluck(:id)
    users = @event.group.members.where.not(id: taken).where("users.name ILIKE :q OR users.email ILIKE :q", q: q)
                  .with_attached_avatar.order(:name, :email).limit(8)
    render json: users.map { |u| u.as_member_json(email: true) }
  end

  # POST /api/events/:token/collaborators { user_id } (group admins)
  def add_collaborator
    user = @event.group.members.find_by(id: params[:user_id])
    return render(json: { error: "Only members of #{@event.group.title} can help edit its events." }, status: :unprocessable_entity) unless user

    @event.collaborators.find_or_create_by!(user: user) { |c| c.added_by = current_user }
    render json: event_json
  end

  # DELETE /api/events/:token/collaborators/:user_id (group admins)
  def remove_collaborator
    @event.collaborators.where(user_id: params[:user_id]).destroy_all
    render json: event_json
  end

  # GET /api/events/:token/poll_options -> polls a Poll block can show: this event's, and
  # the ones you help run that aren't another event's yet
  def poll_options
    mine = SchedulePoll.for_user(current_user).where(event_id: [nil, @event.id]).order(created_at: :desc).limit(50)
    polls = (@event.schedule_polls.to_a + mine.select { |p| p.manager?(current_user) }).uniq
    render json: { polls: polls.map { |p| poll_json(p) }, can_create: true }
  end

  # POST /api/events/:token/polls { poll_token } -> the poll picks a time for this event
  def link_poll
    poll = SchedulePoll.find_by(token: params[:poll_token].to_s)
    return render(json: { error: "You can only add polls you help run." }, status: :forbidden) unless poll&.manager?(current_user)

    poll.update!(event: @event)
    render json: event_json
  end

  # DELETE /api/events/:token/polls/:poll_token
  def unlink_poll
    @event.schedule_polls.where(token: params[:poll_token]).update_all(event_id: nil)
    render json: event_json
  end

  # PUT /api/events/:token/rsvp { status, name, email } -> going / maybe / not_going.
  # Without an account, an email is needed so updates can reach them.
  def rsvp
    return render(json: { error: "This event isn't open for RSVPs yet." }, status: :unprocessable_entity) unless @event.published?
    return render(json: { error: "This event is over." }, status: :unprocessable_entity) if @event.past?

    status = params[:status].presence_in(EventRsvp::STATUSES - ["following"]) || "going"
    rsvp = if current_user
             @event.rsvps.find_or_initialize_by(user: current_user)
           else
             email = params[:email].to_s.strip.downcase
             @event.rsvps.where(user_id: nil).find_by("LOWER(email) = ?", email) || @event.rsvps.new(email: email)
           end
    rsvp.status = status
    rsvp.name = params[:name] if params.key?(:name) && rsvp.guest?
    return render(json: { error: rsvp.errors.full_messages.to_sentence }, status: :unprocessable_entity) unless rsvp.save

    cookies.permanent.signed[rsvp_cookie] = { value: rsvp.token, httponly: true, same_site: :lax } if rsvp.guest?
    render json: event_json
  rescue ActiveRecord::RecordNotUnique
    render json: { error: "That email already has an RSVP." }, status: :unprocessable_entity
  end

  # DELETE /api/events/:token/rsvp -> take back your RSVP (and stop updates)
  def unrsvp
    viewer_rsvp&.destroy!
    @viewer_rsvp = nil
    cookies.delete(rsvp_cookie)
    render json: event_json
  end

  private

  def set_event
    @event = Event.includes(:group).find_by!(token: params[:token] || params[:id])
    render json: { error: "That event isn't here." }, status: :not_found unless @event.visible_to?(current_user)
  rescue ActiveRecord::RecordNotFound
    render json: { error: "That event isn't here." }, status: :not_found
  end

  def require_editor
    render json: { error: "Only the people running this event can do that." }, status: :forbidden unless @event.editable_by?(current_user)
  end

  def require_manager
    render json: { error: "Only #{@event.group.title}'s admins can do that." }, status: :forbidden unless @event.manager?(current_user)
  end

  def render_errors(record)
    render json: { error: record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def parse_blocks(raw)
    raw.is_a?(String) ? JSON.parse(raw) : Array(raw)
  rescue JSON::ParserError
    []
  end

  # A Poll block can show a poll you help run; placing it there makes it this event's poll
  def link_block_polls
    tokens = @event.blocks.filter_map { |b| b["poll_token"] if b["type"] == "poll" }
    SchedulePoll.where(token: tokens, event_id: nil).find_each { |p| p.update!(event: @event) if p.manager?(current_user) }
  end

  def poll_json(poll)
    {
      token: poll.token, title: poll.title, description: poll.description, path: poll.path,
      starts_on: poll.starts_on.iso8601, ends_on: poll.ends_on.iso8601, duration_minutes: poll.duration_minutes,
      choices_count: poll.choices_count, closes_at: poll.closes_at.iso8601, closed: poll.closed?,
      ballots_count: poll.ballots.size, linked: poll.event_id == @event.id,
    }
  end

  def truthy(value) = ActiveModel::Type::Boolean.new.cast(value)

  def rsvp_cookie = :"event_rsvp_#{@event.id}"

  def viewer_rsvp
    return @viewer_rsvp if defined?(@viewer_rsvp)

    @viewer_rsvp = @event.rsvp_for(current_user) ||
                   (cookies.signed[rsvp_cookie] && @event.rsvps.find_by(token: cookies.signed[rsvp_cookie], user_id: nil))
  end

  # A Conscience agenda block carries the live agenda of the business meeting this event
  # announces, for the group's members only
  def blocks_for_viewer(event)
    return event.blocks unless event.blocks.any? { |b| b["type"] == "conscience_agenda" }

    meeting = event.business_meeting
    visible = meeting && BusinessMeeting.visible_to(event.group, current_user).exists?(meeting.id)
    agenda = visible ? meeting.agenda_items.where(status: %w[on_agenda tabled done]).map { |i| i.as_api_json.slice(:id, :kind, :title, :status) } : nil
    event.blocks.map { |b| b["type"] == "conscience_agenda" ? b.merge("agenda" => agenda, "linked" => meeting.present?) : b }
  end

  def event_json
    e = @event.reload
    editor = e.editable_by?(current_user)
    manager = e.manager?(current_user)
    mine = viewer_rsvp
    json = {
      token: e.token, title: e.title, short_description: e.short_description, status: e.status,
      layout: e.layout, time_zone: e.time_zone, location: e.location,
      starts_at: Event.local_value(e.starts_at, e.zone), ends_at: Event.local_value(e.ends_at, e.zone),
      starts_at_iso: e.starts_at&.iso8601, when_label: e.when_label, past: e.past?, zone_label: e.zone.now.strftime("%Z"),
      cover_url: e.image_path(e.cover), flyer_url: e.image_path(e.flyer),
      blocks: blocks_for_viewer(e),
      group: { slug: e.group.slug, title: e.group.title },
      counts: { going: e.rsvps.going.count, maybe: e.rsvps.where(status: "maybe").count },
      my_rsvp: mine && { status: mine.status, name: mine.display_name, email: mine.guest? ? mine.email : nil },
      signed_in: current_user.present?,
      can_edit: editor, can_manage: manager,
      updates: e.updates.order(created_at: :desc).limit(20).map(&:as_api_json),
      polls: e.schedule_polls.includes(:ballots).order(:created_at).map { |p| poll_json(p) },
      short_description_max: Event::SHORT_DESCRIPTION_MAX,
    }
    if editor
      json[:admins] = e.group.admins.with_attached_avatar.map { |u| u.as_member_json(email: true) }
      json[:collaborators] = e.collaborator_users.with_attached_avatar.map { |u| u.as_member_json(email: true) }
      json[:rsvps] = e.rsvps.includes(user: { avatar_attachment: :blob }).order(:created_at).map { |r| r.as_api_json(email: true) }
      json[:followers_count] = e.followers.count
    end
    json
  end
end
