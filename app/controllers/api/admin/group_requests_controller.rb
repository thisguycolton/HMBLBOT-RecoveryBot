# Site Admin > Group requests: groups people started from an intergroup listing
# (POST /api/groups/start), waiting for a site admin to say yes or no.
class Api::Admin::GroupRequestsController < Api::Admin::SuiteController
  def index
    groups = Group.where(status: "pending").includes(:created_by, :meetings).order(created_at: :desc)
    listings = OiaaMeeting.includes(:meeting_directory).where(slug: groups.flat_map { |g| g.meetings.map(&:oiaa_slug) }.compact.uniq).index_by(&:slug)
    render json: { group_requests: groups.map { |g| request_json(g, listings) } }
  end

  # POST /api/admin/group_requests/:id/approve -> live, run by whoever started it
  def approve
    group = pending_group
    group.approve!
    render json: { ok: true, slug: group.slug }
  end

  # POST /api/admin/group_requests/:id/decline { reason } -> removed; whoever started it is told
  def decline
    pending_group.decline!(params[:reason])
    head :no_content
  end

  private

  def pending_group = Group.where(status: "pending").find(params[:id])

  def request_json(group, listings)
    slug = group.meetings.map(&:oiaa_slug).compact.first
    listing = listings[slug]
    starter = group.created_by
    {
      id: group.id, slug: group.slug, title: group.title, description: group.description, time_zone: group.time_zone,
      created_at: group.created_at.iso8601,
      meetings: group.meetings.sort_by { |m| [m.day_of_week || 7, m.start_minute || 0] }.map { |m| { name: m.name, schedule_label: m.schedule_label } },
      started_by: starter && { name: starter.display_name, username: starter.username, email: starter.email,
                               joined_at: starter.created_at.iso8601, confirmed: !!starter.confirmed },
      listing: listing && { slug: listing.slug, name: listing.name, group_name: listing.group_name,
                            source: listing.meeting_directory&.name || "AA Intergroup" },
    }
  end
end
