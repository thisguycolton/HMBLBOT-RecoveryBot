# A group's motions (app/models/motion.rb): every motion made at its meetings, by Robert's
# Rules, with how it was voted and what became of it; the decisions log is the main ones. Who sees
# which is Motion.visible_to (visitors get Public decisions that passed, members the Members
# ones too, record keepers everything). Record keepers write and change them; group admins
# delete. Voting happens in the room, so none of the checks here stop anything being saved.
class Api::GroupMotionsController < ApplicationController
  include GroupScoped

  skip_before_action :authenticate_user!, only: :index
  before_action :set_viewable_group, only: :index
  before_action :set_group, except: :index
  before_action :require_keeper, only: %i[create update check bulk export import]
  before_action :require_manager, only: :destroy
  before_action :set_motion, only: %i[update destroy]

  # GET /api/groups/:group_slug/motions?q= -> every decision the viewer may see, newest first
  def index
    scope = Motion.visible_to(@group, current_user)
    visible = scope.pluck(:id)
    @meetings = BusinessMeeting.visible_to(@group, current_user).pluck(:id)
    motions = (params[:q].present? ? Motion.search(scope, params[:q]) : scope).includes(:supersedes, :parent, business_meeting: :group).newest_first.to_a
    render json: { motions: motions.map { |m| m.as_api_json(replacers: replacers, visible: visible, meetings: @meetings, keeper: keeper?) },
                   can_edit: keeper?, can_delete: @group.manageable_by?(current_user) }.merge(MotionKinds.metadata)
  end

  # POST /api/groups/:group_slug/motions/check { motion: {...} } -> what the rules say about a
  # record as it's being typed, without saving it
  def check
    motion = params[:id].present? ? @group.motions.find(params[:id]) : @group.motions.new
    motion.assign_attributes(motion_params)
    render json: { warnings: motion.warnings, required: motion.required_vote_key }
  end

  # POST /api/groups/:group_slug/motions
  def create
    @motion = @group.motions.new(motion_params.merge(created_by: current_user))
    return render_errors(@motion) unless @motion.save

    settle
    render json: motion_json, status: :created
  end

  # PATCH /api/groups/:group_slug/motions/:id
  def update
    return render_errors(@motion) unless @motion.update(motion_params.merge(needs_review: false))

    settle
    render json: motion_json
  end

  # DELETE /api/groups/:group_slug/motions/:id (group admins). What it replaced is standing
  # again, and documents it adopted lose that note.
  def destroy
    @motion.destroy!
    head :no_content
  end

  BULK_ACTIONS = %w[ignore_rules follow_rules one_time standing mark_checked category visibility status delete].freeze

  # POST /api/groups/:group_slug/motions/bulk { ids: [], do: "ignore_rules" | "follow_rules" |
  # "one_time" | "standing" | "mark_checked" | "category" | "visibility" | "status" | "delete", value } -> { updated: n }
  # (deleting is for group admins, as one at a time is)
  def bulk
    action = params[:do].to_s
    return render(json: { error: "Pick something to do." }, status: :unprocessable_entity) unless BULK_ACTIONS.include?(action)
    return render(json: { error: "Only this group's admins can delete decisions." }, status: :forbidden) if action == "delete" && !@group.manageable_by?(current_user)

    motions = @group.motions.where(id: Array(params[:ids]))
    value = params[:value].to_s
    n = Motion.transaction do
      case action
      when "ignore_rules" then motions.update_all(ignore_rules: true, updated_at: Time.current)
      when "follow_rules" then motions.update_all(ignore_rules: false, updated_at: Time.current)
      when "one_time" then motions.update_all(one_time: true, updated_at: Time.current)
      when "standing" then motions.update_all(one_time: false, updated_at: Time.current)
      when "mark_checked" then motions.update_all(needs_review: false, updated_at: Time.current)
      when "category"
        return render(json: { error: "That isn't a category." }, status: :unprocessable_entity) unless Motion::CATEGORIES.include?(value)

        motions.update_all(category: value, updated_at: Time.current)
      when "status"
        return render(json: { error: "That isn't a way a motion comes out." }, status: :unprocessable_entity) unless Motion::STATUSES.include?(value)

        # A decided one needs its date: keep the one it has, else its meeting's, else today
        if Motion::DECIDED.include?(value)
          motions.where(decided_on: nil).where.not(business_meeting_id: nil)
                 .update_all("decided_on = (SELECT held_on FROM business_meetings WHERE business_meetings.id = motions.business_meeting_id)")
          motions.where(decided_on: nil).update_all(decided_on: @group.zone.today)
        end
        motions.update_all(status: value, updated_at: Time.current)
      when "visibility"
        return render(json: { error: "That isn't a visibility." }, status: :unprocessable_entity) unless Motion::VISIBILITIES.include?(value)

        motions.update_all(visibility: value, updated_at: Time.current)
      when "delete" then motions.destroy_all.size
      end
    end
    render json: { updated: n }
  end

  # GET /api/groups/:group_slug/motions/export -> every motion as a RecoveryBot decisions file
  # (DecisionsJson), for record keepers
  def export
    send_data JSON.pretty_generate(DecisionsJson.export(@group)), type: :json, disposition: "attachment",
                                                                  filename: "#{@group.slug}-decisions.recoverybot.json"
  end

  # POST /api/groups/:group_slug/motions/import { file: "<the file's text>", dry_run } -> what it
  # changes, row by row; saved only when dry_run is false and nothing in it has a problem
  def import
    dry = params.key?(:dry_run) ? ActiveModel::Type::Boolean.new.cast(params[:dry_run]) : true
    render json: DecisionsJson.new(@group, params[:file], can_delete: @group.manageable_by?(current_user), user: current_user).run(dry_run: dry)
  rescue DecisionsJson::Invalid => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def set_motion
    @motion = @group.motions.find(params[:id])
  end

  def replacers = @replacers ||= Motion.replacers_for(@group)

  def motion_json
    @motion.reload.as_api_json(visible: Motion.visible_to(@group, current_user).pluck(:id),
                               meetings: BusinessMeeting.visible_to(@group, current_user).pluck(:id), keeper: keeper?)
  end

  # What a passed motion does to the one it applies to, and the agenda item a decision settles
  def settle
    @motion.apply_effect!
    @motion.settle_agenda_item!
  end

  def motion_params
    params.require(:motion).permit(:title, :text, :moved_by_name, :seconded_by_name, :status, :votes_for, :votes_against,
                                   :abstentions, :minority_opinion, :decided_on, :category, :supersedes_id, :visibility,
                                   :business_meeting_id, :agenda_item_id, :kind, :parent_id, :vote_method, :required_vote,
                                   :previous_notice, :committee, :postponed_to, :amended_text, :note, :ignore_rules, :one_time)
  end
end
