# "Available to sponsor" (SponsorProfile): your own offer (GET/PATCH /api/sponsor_profile),
# and the people offering in your groups (GET /api/sponsor_profile/find)
class Api::SponsorProfilesController < ApplicationController
  before_action :authenticate_user!

  def show
    render json: settings_json
  end

  # PATCH { available, note, picks, languages, show_time_sober, max_sponsees }
  def update
    profile = SponsorProfile.for(current_user)
    profile.assign_attributes(params.permit(:available, :note, :languages, :show_time_sober, :max_sponsees, picks: []).to_h)
    profile.max_sponsees = nil if params.key?(:max_sponsees) && params[:max_sponsees].blank?
    return render(json: { error: profile.errors.full_messages.to_sentence }, status: :unprocessable_entity) unless profile.save

    render json: settings_json
  end

  # GET /api/sponsor_profile/find -> people in your groups offering to sponsor
  def find
    asked = Sponsorship.where(sponsee_id: current_user.id, status: %w[pending active]).pluck(:sponsor_id, :status).to_h
    render json: {
      sponsors: SponsorProfile.visible_to(current_user).map { |p, groups| p.as_card_json(groups).merge(status: asked[p.user_id]) },
      in_groups: current_user.groups.exists?,
    }
  end

  private

  def settings_json
    { profile: SponsorProfile.for(current_user).as_settings_json, picks: SponsorProfile::PICKS, note_max: SponsorProfile::NOTE_MAX }
  end
end
