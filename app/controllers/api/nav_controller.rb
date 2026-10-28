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
      hosting: { open_requests: HostCommitments.new(current_user).open_sub_requests.size, host: current_user.host? },
      # Give a chip (/recovery/give) is for the groups they host for
      can_give_chips: memberships.any? { |m| m.group.can_host?(current_user) },
      today: PeopleHome.new(current_user).json,
    }
  end

  private

  def group_json(membership)
    group = membership.group
    admin = membership.role == "admin"
    {
      slug: group.slug, title: group.title,
      logo_url: group.logo.attached? ? Rails.application.routes.url_helpers.rails_storage_proxy_path(group.logo, only_path: true) : nil,
      roles: {
        admin: admin,
        record_keeper: admin || membership.can_keep_records,
        host_coordinator: admin || membership.can_schedule_hosts,
        treasurer: admin || membership.can_keep_records || membership.can_keep_treasury,
        host: membership.can_host,
      },
      requests: admin ? group.memberships.requested.count : 0,
    }
  end
end
