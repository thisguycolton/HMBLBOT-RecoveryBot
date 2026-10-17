# A group's decisions log (app/models/motion.rb): what it voted on, with the count and what
# it replaced. Who sees which is Motion.visible_to (visitors get Public decisions that
# passed, members the Members ones too, record keepers everything). Record keepers write
# and change them; group admins delete.
class Api::GroupMotionsController < ApplicationController
  include GroupScoped

  skip_before_action :authenticate_user!, only: :index
  before_action :set_viewable_group, only: :index
  before_action :set_group, except: :index
  before_action :require_keeper, only: %i[create update]
  before_action :require_manager, only: :destroy
  before_action :set_motion, only: %i[update destroy]

  # GET /api/groups/:group_slug/motions?q= -> every decision the viewer may see, newest first
  def index
    scope = Motion.visible_to(@group, current_user)
    visible = scope.pluck(:id)
    motions = (params[:q].present? ? Motion.search(scope, params[:q]) : scope).includes(:supersedes).newest_first.to_a
    render json: { motions: motions.map { |m| m.as_api_json(replacers: replacers, visible: visible) },
                   can_edit: keeper?, can_delete: @group.manageable_by?(current_user) }
  end

  # POST /api/groups/:group_slug/motions
  def create
    @motion = @group.motions.new(motion_params.merge(created_by: current_user))
    @motion.save ? render(json: motion_json, status: :created) : render_errors(@motion)
  end

  # PATCH /api/groups/:group_slug/motions/:id
  def update
    @motion.update(motion_params) ? render(json: motion_json) : render_errors(@motion)
  end

  # DELETE /api/groups/:group_slug/motions/:id (group admins). What it replaced is standing
  # again, and documents it adopted lose that note.
  def destroy
    @motion.destroy!
    head :no_content
  end

  private

  def set_motion
    @motion = @group.motions.find(params[:id])
  end

  def replacers = @replacers ||= Motion.replacers_for(@group)

  def motion_json
    @motion.reload.as_api_json(visible: Motion.visible_to(@group, current_user).pluck(:id))
  end

  def motion_params
    params.require(:motion).permit(:title, :text, :moved_by_name, :seconded_by_name, :status, :votes_for, :votes_against,
                                   :abstentions, :minority_opinion, :decided_on, :category, :supersedes_id, :visibility)
  end
end
