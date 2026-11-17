# What the site's shell (components/shell) needs on every page for a signed-in member: their
# groups with the roles they hold in each (the sidebar's "Your groups"), how many "Need a sub"
# requests they could take (the badge on Hosting) and what's coming up today (PeopleHome: the
# Today panel, and the "On now" bar on phones).
class Api::NavController < ApplicationController
  before_action :authenticate_user!

  # GET /api/nav
  def show
    memberships = current_user.group_memberships.active.includes(group: { logo_attachment: :blob }).to_a
                              .sort_by { |m| m.group.title.downcase }
    render json: {
      me: { name: current_user.display_name, username: current_user.username, avatar_url: current_user.avatar_url },
      groups: memberships.map { |m| group_json(m) },
      # Groups they asked to join, still waiting for an admin: the sidebar shows them greyed
      waiting_groups: current_user.group_memberships.requested.includes(group: { logo_attachment: :blob }).map(&:group)
                                  .select(&:active?).sort_by { |g| g.title.downcase }.map { |g| { slug: g.slug, title: g.title, logo_url: logo_url(g) } },
      hosting: { open_requests: HostCommitments.new(current_user).open_sub_requests.size, host: current_user.host? },
      today: PeopleHome.new(current_user).json,
      # Site admins only (nil for everyone else): the sidebar's "Everyone's posts" switch
      site_admin: (current_user.suite_admin? ? { see_all_posts: current_user.see_all_posts } : nil),
    }
  end

  private

  def group_json(membership)
    group = membership.group
    admin = membership.role == "admin"
    {
      slug: group.slug, title: group.title,
      logo_url: logo_url(group),
      roles: {
        admin: admin,
        record_keeper: admin || membership.can_keep_records,
        host_coordinator: admin || membership.can_schedule_hosts,
        treasurer: admin || membership.can_keep_records || membership.can_keep_treasury,
        host: membership.can_host,
      },
      requests: admin ? group.memberships.requested.count : 0,
      # Messages they haven't read in the group's chat channels they're in
      chat_unread: ChatChannel.unread_counts(group.chat_channels.open.select { |c| c.readable_by?(current_user, membership) }, current_user).values.sum,
      # Give a chip (/recovery/give?group=) is in the folder of each group they host for
      can_give: group.gives_chips?(current_user),
    }
  end

  def logo_url(group)
    group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(group.logo, only_path: true) : nil
  end
end
