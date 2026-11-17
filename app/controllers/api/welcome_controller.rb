# The welcome wizard's own calls (WelcomeController, components/welcome/). Joining, following
# and starting a group use the Groups endpoints everyone else does: POST /api/groups/:slug/join,
# /api/intergroup_pages/:oiaa_slug/follow and /api/groups/start.
class Api::WelcomeController < ApplicationController
  include GroupScoped

  before_action :require_feature, only: :groups

  # GET /api/welcome/groups?q= -> groups on RecoveryBot first (with no search: the busiest
  # ones), then the AA Intergroup and local intergroup listings with no group here yet, one
  # per group name, which can be followed or started
  def groups
    OiaaFeed.refresh_if_stale
    q = params[:q].to_s.squish.first(100)
    mine = current_user.group_memberships.index_by(&:group_id)
    groups = registered(q)
    listings = []

    if q.present?
      records = OiaaMeeting.search(q, limit: 80).includes(:meeting_directory).to_a
      linked = Meeting.where(oiaa_slug: records.map(&:slug)).includes(:group).to_a
      keys = records.map { |r| IntergroupFollow.key_for(r) }.uniq
      titled = Group.where("LOWER(title) IN (?)", keys.presence || [""]).to_a
      here = (linked.map(&:group) + titled).uniq
      # a listing whose group is already here shows that group instead, so nobody starts a second copy
      groups = (groups + here.select(&:active?)).uniq.first(12)
      taken = linked.map(&:oiaa_slug).to_set
      pending = here.reject(&:active?).map { |g| g.title.to_s.squish.downcase }.to_set
      active_titles = here.select(&:active?).map { |g| g.title.to_s.squish.downcase }.to_set
      following = IntergroupFollow.where(user: current_user, group_name: keys).pluck(:group_name).to_set
      followers = IntergroupFollow.waiting.where(group_name: keys).group(:group_name).count

      listings = records.reject { |r| taken.include?(r.slug) || active_titles.include?(IntergroupFollow.key_for(r)) }
                        .group_by { |r| IntergroupFollow.key_for(r) }.first(10).map do |key, rows|
        first = rows.first
        {
          slug: first.slug, name: first.group_name.presence || first.name, source: first.source_name,
          attendance: first.attendance, schedules: rows.map(&:schedule_label).uniq.first(3),
          more: [rows.map(&:schedule_label).uniq.size - 3, 0].max,
          following: following.include?(key), followers: followers[key].to_i,
          starting: pending.include?(key), # someone has started it here; it's waiting for approval
        }
      end
    end

    render json: {
      suggested: q.blank?,
      groups: Group.where(id: groups.map(&:id)).includes(:meetings, logo_attachment: :blob)
                   .sort_by { |g| groups.index { |x| x.id == g.id } }.map { |g| card(g, mine[g.id]) },
      listings: listings,
      listings_ready: OiaaFeed.last_synced_at.present?,
    }
  end

  # POST /api/welcome/finish -> done (or skipped): the wizard won't come back by itself
  def finish
    current_user.finish_onboarding!
    head :no_content
  end

  private

  def require_feature
    render json: { error: "Groups isn't open yet." }, status: :forbidden unless Group.feature_open_to?(current_user)
  end

  def registered(q)
    scope = Group.active
    if q.present?
      like = "%#{Group.sanitize_sql_like(q)}%"
      by_meeting = Meeting.where("meetings.name ILIKE ?", like)
      id = OiaaFeed.conference_id(q)
      by_meeting = by_meeting.or(Meeting.where(oiaa_slug: OiaaMeeting.listed.where(conference_id: id).select(:slug))) if id
      scope.where("groups.title ILIKE ?", like).or(scope.where(id: by_meeting.select(:group_id))).order(:title).limit(12).to_a
    else
      scope.order(Arel.sql("(SELECT COUNT(*) FROM group_memberships gm WHERE gm.group_id = groups.id AND gm.status = 'active') DESC"), :title)
           .limit(6).to_a
    end
  end

  def card(group, membership)
    upcoming = group.meetings.reject { |m| m.once? && (m.next_start.nil? || m.next_start < Time.current) }
                    .sort_by { |m| m.next_start || 1.year.from_now }
    {
      slug: group.slug, title: group.title, description: group.description.to_s.squish.truncate(140).presence,
      logo_url: group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(group.logo, only_path: true) : nil,
      members_count: group.active_memberships.size, meetings_count: group.meetings.size,
      next_meeting: upcoming.first&.schedule_label, membership_status: membership&.status,
    }
  end
end
