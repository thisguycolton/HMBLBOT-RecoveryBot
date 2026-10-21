# Groups (app/models/group.rb), behind the React app at /groups
# (app/javascript/entrypoints/groups.jsx).
class Api::GroupsController < ApplicationController
  include GroupScoped

  # Anyone sees an active group's page, signed in or not; any account may ask to join it
  skip_before_action :authenticate_user!, only: :show
  before_action :set_viewable_group, only: %i[show join leave]
  before_action :set_group, only: %i[update destroy approve regenerate_invite court_verifications]
  before_action :require_manager, only: %i[update regenerate_invite court_verifications]
  # Listing your own groups is open to anyone in one (the My groups window in the nav)
  before_action :require_feature, only: %i[create find start]

  # GET /api/groups -> your groups and join requests
  def index
    memberships = current_user.group_memberships.includes(group: :meetings).order(created_at: :desc)
    others = current_user.suite_admin? ? Group.where.not(id: memberships.map(&:group_id)).includes(:meetings).order(:title) : Group.none
    render json: {
      can_create: current_user.suite_admin?,
      groups: memberships.map { |m| group_card(m.group, m) } + others.map { |g| group_card(g, nil) },
    }
  end

  # GET /api/groups/:slug
  def show
    OiaaFeed.refresh_if_stale if @group.meetings.linked_to_oiaa.exists?
    render json: group_json
  end

  # POST /api/groups (site admins)
  def create
    return render(json: { error: "Only admins can make groups for now." }, status: :forbidden) unless current_user.suite_admin?

    @group = Group.new(group_params.merge(created_by: current_user))
    Group.transaction do
      @group.save!
      @group.memberships.create!(user: current_user, role: "admin")
    end
    render json: group_json, status: :created
  rescue ActiveRecord::RecordInvalid
    render_errors(@group)
  end

  # PATCH /api/groups/:slug
  def update
    @group.logo.purge_later if ActiveModel::Type::Boolean.new.cast(params.dig(:group, :remove_logo)) && params.dig(:group, :logo).blank?
    @group.update(group_params) ? render(json: group_json) : render_errors(@group)
  end

  # DELETE /api/groups/:slug (site admins)
  def destroy
    return render(json: { error: "Only site admins can delete a group." }, status: :forbidden) unless current_user.suite_admin?

    @group.destroy!
    head :no_content
  end

  # GET /api/groups/find?q=&day=&start_minute=&time_zone= -> groups here, and OIAA meetings
  # that aren't a group here yet ("Find your group")
  def find
    OiaaFeed.refresh_if_stale
    q = params[:q].to_s.strip
    day = params[:day].presence&.to_i
    start = params[:start_minute].presence&.to_i

    groups = Group.active
    if q.present?
      like = "%#{Group.sanitize_sql_like(q)}%"
      id = OiaaFeed.conference_id(q)
      by_meeting = Meeting.where("meetings.name ILIKE ?", like)
      by_meeting = by_meeting.or(Meeting.where(oiaa_slug: OiaaMeeting.listed.where(conference_id: id).select(:slug))) if id
      by_meeting = by_meeting.or(Meeting.where(conference_url: q)) if q.start_with?("http")
      groups = groups.where("groups.title ILIKE ?", like).or(groups.where(id: by_meeting.select(:group_id)))
    elsif day && start
      zone = ActiveSupport::TimeZone[params[:time_zone].to_s] || Time.zone
      target = OiaaFeed.utc_week_minute(day, start, zone)
      ids = Meeting.weekly.select { |m| OiaaFeed.week_gap(target, OiaaFeed.utc_week_minute(m.day_of_week, m.start_minute, m.zone)) <= 15 }.map(&:group_id)
      groups = groups.where(id: ids)
    else
      groups = Group.none
    end

    oiaa = if q.present?
             OiaaMeeting.search(q, limit: 15)
           elsif day && start
             OiaaFeed.matches(day: day, start_minute: start, time_zone: params[:time_zone], limit: 15).map { |m| m[:record] }
           else
             []
           end
    linked = Meeting.where(oiaa_slug: oiaa.map(&:slug)).includes(:group).group_by(&:oiaa_slug)
    # a group here with the listing's name counts too, so nobody starts a second copy of it
    names = oiaa.flat_map { |r| [r.group_name, r.name] }.compact.map(&:downcase).uniq
    by_title = Group.where("LOWER(title) IN (?)", names.presence || [""]).index_by { |g| g.title.downcase }
    mine = current_user.group_memberships.index_by(&:group_id)

    render json: {
      groups: groups.includes(:meetings).limit(15).map { |g| group_card(g, mine[g.id]) },
      oiaa: oiaa.map do |r|
        group = linked[r.slug]&.first&.group || by_title[r.group_name.to_s.downcase] || by_title[r.name.downcase]
        r.as_api_json.merge(group: group && { slug: group.slug, title: group.title, status: mine[group.id]&.status })
      end,
      oiaa_ready: OiaaFeed.last_synced_at.present?,
    }
  end

  # POST /api/groups/start { oiaa_slug } -> a pending group made from an OIAA listing, run
  # by whoever started it once a site admin approves it
  def start
    record = OiaaMeeting.listed.find_by!(slug: params[:oiaa_slug])
    existing = Meeting.find_by(oiaa_slug: record.slug)&.group ||
               Group.find_by("LOWER(title) IN (?)", [record.group_name, record.name].compact.map(&:downcase))
    if existing
      return render(json: { error: "That meeting already has a group here.", slug: existing.slug }, status: :unprocessable_entity)
    end

    @group = Group.new(title: record.group_name.presence || record.name, status: "pending", created_by: current_user,
                       time_zone: Group::TIME_ZONES.include?(record.zone.tzinfo.name) ? record.zone.tzinfo.name : "America/Phoenix")
    Group.transaction do
      @group.save!
      @group.memberships.create!(user: current_user, role: "admin")
      record.days.each { |day| @group.meetings.new.apply_oiaa(record, day: day).save! }
    end
    Notification.deliver(User.suite_admins, kind: "group.pending", title: "#{current_user.display_name} started “#{@group.title}”",
                                            body: "It's waiting for your approval.", url: "/groups/#{@group.slug}")
    render json: group_json, status: :created
  rescue ActiveRecord::RecordInvalid
    render_errors(@group)
  end

  # POST /api/groups/:slug/join -> ask to join (a group admin approves)
  def join
    membership = @group.memberships.find_or_initialize_by(user: current_user)
    if membership.new_record?
      membership.update!(role: "member", status: "requested")
      @group.notify_admins(kind: "group.join_request", title: "#{current_user.display_name} asked to join #{@group.title}")
    end
    render json: group_json
  end

  # POST /api/groups/join_with_token { token } -> the invite link
  def join_with_token
    @group = Group.find_by!(join_token: params[:token].to_s)
    membership = @group.memberships.find_or_initialize_by(user: current_user)
    membership.update!(status: "active", role: membership.role.presence || "member")
    render json: group_json
  end

  # POST /api/groups/:slug/leave (also withdraws a join request)
  def leave
    membership = @group.membership_for(current_user)
    if membership&.admin? && @group.admins.count == 1 && @group.members.count > 1
      return render(json: { error: "Make someone else an admin before you leave." }, status: :unprocessable_entity)
    end

    membership&.destroy!
    current_user.user_active_group&.destroy if current_user.user_active_group&.group_id == @group.id
    head :no_content
  end

  # POST /api/groups/:slug/approve (site admins approve a group someone started)
  def approve
    return render(json: { error: "Only site admins can approve groups." }, status: :forbidden) unless current_user.suite_admin?

    @group.update!(status: "active")
    Notification.deliver(@group.admins, kind: "group.approved", title: "#{@group.title} is approved", url: "/groups/#{@group.slug}")
    IntergroupFollow.announce!(@group)
    render json: group_json
  end

  # POST /api/groups/:slug/regenerate_invite -> the old invite link stops working
  def regenerate_invite
    @group.update!(join_token: Group.new_token)
    render json: group_json
  end

  # GET /api/groups/:slug/court_verifications (group admins)
  def court_verifications
    rows = @group.court_verifications.includes(:meeting).order(meeting_at: :desc).limit(500)
    render json: { verifications: rows.map(&:as_admin_json) }
  end

  # POST /api/groups/dismiss_prompt -> hide "You're not in a group yet" for 30 days
  def dismiss_prompt
    current_user.update_column(:group_prompt_dismissed_at, Time.current)
    head :no_content
  end

  private

  def require_feature
    render json: { error: "Groups isn't open yet." }, status: :forbidden unless Group.feature_open_to?(current_user)
  end

  def group_params
    params.require(:group).permit(:title, :description, :website, :time_zone, :court_email_subject, :court_email_body, :court_email_reply_to,
                                  :quorum_count, :quorum_percent, :logo, :follows_roberts_rules, :show_hosts_publicly)
  end

  def group_card(group, membership)
    upcoming = group.meetings.sort_by { |m| m.next_start || Time.current }.reject { |m| m.once? && m.next_start < Time.current }
    {
      slug: group.slug, title: group.title, description: group.description, status: group.status,
      logo_url: group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(group.logo, only_path: true) : nil,
      role: membership&.role, membership_status: membership&.status,
      meetings_count: group.meetings.size, next_meeting: upcoming.first&.then { |m| { name: m.name, schedule_label: m.schedule_label, next_start: m.next_start.iso8601 } },
    }
  end

  def group_json
    membership = @group.membership_for(current_user)
    member = current_user&.suite_admin? || membership&.active?
    manager = @group.manageable_by?(current_user)
    json = {
      slug: @group.slug, title: @group.title, description: @group.description, website: @group.website,
      time_zone: @group.time_zone, status: @group.status,
      role: membership&.role, membership_status: membership&.status,
      is_member: !!membership&.active?, can_manage: manager, can_keep_records: @group.records_editable_by?(current_user), can_schedule_hosts: @group.hosts_editable_by?(current_user), can_keep_treasury: @group.treasury_editable_by?(current_user), can_host: @group.can_host?(current_user), is_site_admin: !!current_user&.suite_admin?, signed_in: current_user.present?,
      meetings: @group.meetings.ordered.map(&:as_api_json),
      oiaa_synced_at: OiaaFeed.last_synced_at&.iso8601,
      members_count: @group.members.count,
      follows_roberts_rules: @group.follows_roberts_rules, show_hosts_publicly: @group.show_hosts_publicly,
      premium: @group.premium?, premium_state: (@group.premium_state if Premium.enforced?),
      logo_url: @group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.logo, only_path: true) : nil,
      cover_url: @group.cover.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(@group.cover, only_path: true) : nil,
    }
    # The 7th Tradition link hosts share in the meeting (never on the public page)
    json[:contribution_url] = "#{request.base_url}#{@group.contribution_path}" if @group.takes_contributions? && @group.can_host?(current_user)
    if member
      json[:members] = @group.active_memberships.includes(user: { avatar_attachment: :blob }).sort_by { |m| [m.admin? ? 0 : 1, m.user.display_name.downcase] }
                             .map { |m| m.user.as_member_json(email: manager).merge(role: m.role, membership_id: m.id, can_keep_records: m.can_keep_records, can_schedule_hosts: m.can_schedule_hosts, can_keep_treasury: m.can_keep_treasury, can_host: m.can_host) }
      json[:books] = @group.group_books.includes(book: { cover_image_attachment: :blob }).order(:created_at).map do |gb|
        { id: gb.id, note: gb.note, book: { slug: gb.book.slug, title: gb.book.title, author: gb.book.author, cover_url: gb.book.cover_url, cover_color: gb.book.cover_color } }
      end
      json[:readings] = @group.shared_readings.includes(user: { avatar_attachment: :blob }).limit(50).map do |r|
        { id: r.id, title: r.title, meeting_date: r.meetingDate&.iso8601, published_at: r.published_at&.iso8601, author: r.user&.as_member_json }
      end
    end
    if manager
      json[:requests] = @group.memberships.requested.includes(user: { avatar_attachment: :blob }).map { |m| m.user.as_member_json(email: true).merge(membership_id: m.id) }
      json[:invite_url] = "#{request.base_url}/groups/join/#{@group.join_token}"
      json[:court_form_url] = "#{request.base_url}/court_verifications/new?group=#{@group.slug}"
      json[:court_email] = @group.court_email_json
      json[:quorum] = { count: @group.quorum_count, percent: @group.quorum_percent, needed: @group.quorum_needed }
    end
    json
  end
end
