# The page of an AA Intergroup group that isn't a group here yet: the default page, with
# the meetings AA Intergroup lists under its name (/groups/find/:oiaa_slug).
class Api::IntergroupPagesController < ApplicationController
  include GroupScoped

  # Open to everyone, signed in or not, like Find a meeting; following needs an account
  skip_before_action :authenticate_user!, only: :show

  # GET /api/intergroup_pages/:oiaa_slug -> the page, or { group_slug } once it's a group here
  def show
    OiaaFeed.refresh_if_stale
    record = OiaaMeeting.listed.find_by!(slug: params[:oiaa_slug])
    names = [record.group_name, record.name].compact.map(&:downcase)
    group = Meeting.find_by(oiaa_slug: record.slug)&.group || Group.find_by("LOWER(title) IN (?)", names)
    return render(json: { group_slug: group.slug }) if group&.page_visible_to?(current_user)

    listings = OiaaMeeting.for_group(record.group_name.presence || record.name).to_a
    listings = [record] if listings.empty?
    json = GroupPage.new(current_user).intergroup_json(listings, slug: record.slug)
    key = IntergroupFollow.key_for(record)
    json[:follow] = { following: !!current_user && IntergroupFollow.exists?(user: current_user, group_name: key),
                      followers: IntergroupFollow.waiting.where(group_name: key).count, signed_in: current_user.present? }
    render json: json
  end

  # POST /api/intergroup_pages/:oiaa_slug/follow -> hear when it comes to RecoveryBot
  def follow
    record = OiaaMeeting.listed.find_by!(slug: params[:oiaa_slug])
    IntergroupFollow.find_or_create_by!(user: current_user, group_name: IntergroupFollow.key_for(record)) { |f| f.oiaa_slug = record.slug }
    render json: { following: true }
  end

  # DELETE /api/intergroup_pages/:oiaa_slug/follow
  def unfollow
    record = OiaaMeeting.listed.find_by!(slug: params[:oiaa_slug])
    IntergroupFollow.where(user: current_user, group_name: IntergroupFollow.key_for(record)).destroy_all
    render json: { following: false }
  end
end
