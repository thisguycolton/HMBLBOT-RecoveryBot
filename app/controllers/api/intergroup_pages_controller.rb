# The page of an AA Intergroup group that isn't a group here yet: the default page, with
# the meetings AA Intergroup lists under its name (/groups/find/:oiaa_slug).
class Api::IntergroupPagesController < ApplicationController
  include GroupScoped

  # GET /api/intergroup_pages/:oiaa_slug -> the page, or { group_slug } once it's a group here
  def show
    return render(json: { error: "Groups isn't open yet." }, status: :forbidden) unless Group.feature_open_to?(current_user)

    OiaaFeed.refresh_if_stale
    record = OiaaMeeting.listed.find_by!(slug: params[:oiaa_slug])
    names = [record.group_name, record.name].compact.map(&:downcase)
    group = Meeting.find_by(oiaa_slug: record.slug)&.group || Group.find_by("LOWER(title) IN (?)", names)
    return render(json: { group_slug: group.slug }) if group&.visible_to?(current_user)

    listings = OiaaMeeting.for_group(record.group_name.presence || record.name).to_a
    listings = [record] if listings.empty?
    render json: GroupPage.new(current_user).intergroup_json(listings, slug: record.slug)
  end
end
