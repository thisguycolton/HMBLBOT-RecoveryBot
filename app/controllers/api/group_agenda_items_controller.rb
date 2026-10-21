# The agenda of a business meeting. Members suggest items (which record keepers hear about and
# put on the agenda); record keepers add, change, reorder and remove them.
class Api::GroupAgendaItemsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_premium, only: %i[create update destroy reorder]
  before_action :require_member
  before_action :set_meeting
  before_action :set_item, only: %i[update destroy]
  before_action :require_keeper, only: :reorder

  # POST /api/groups/:group_slug/business_meetings/:business_meeting_id/agenda_items
  def create
    return render(json: { error: "That meeting is over." }, status: :unprocessable_entity) unless keeper? || @meeting.planned?

    attrs = item_params
    attrs = attrs.slice(:kind, :title, :details).merge(status: "suggested") unless keeper?
    item = @meeting.agenda_items.new(attrs.merge(submitted_by: current_user))
    carry_motion(item) if keeper?
    return render_errors(item) unless item.save

    tell_record_keepers(item) if item.suggested? && !keeper?
    render json: item.as_api_json(viewer: current_user), status: :created
  end

  # PATCH .../agenda_items/:id (record keepers; a member can reword their own suggestion)
  def update
    attrs = item_params
    attrs = attrs.slice(:kind, :title, :details) unless keeper?
    @item.update(attrs) ? render(json: @item.as_api_json(viewer: current_user)) : render_errors(@item)
  end

  # DELETE .../agenda_items/:id (record keepers; a member can take back their own suggestion)
  def destroy
    @item.destroy!
    head :no_content
  end

  # POST .../agenda_items/reorder { ids: [3, 1, 2] }
  def reorder
    ids = Array(params[:ids]).map(&:to_i)
    items = @meeting.agenda_items.index_by(&:id)
    AgendaItem.transaction { ids.filter_map { |id| items[id] }.each_with_index { |item, i| item.update!(position: i + 1) } }
    render json: { agenda: @meeting.agenda_items.reload.includes(:submitted_by).map { |i| i.as_api_json(viewer: current_user) } }
  end

  private

  def set_meeting
    @meeting = BusinessMeeting.visible_to(@group, current_user).find(params[:business_meeting_id])
  end

  def set_item
    @item = @meeting.agenda_items.find(params[:id])
    return if keeper? || (@item.submitted_by_id == current_user.id && @item.suggested?)

    render json: { error: "Only this group's record keepers can change the agenda." }, status: :forbidden
  end

  def item_params
    params.require(:agenda_item).permit(:kind, :title, :details, :status, :motion_id)
  end

  # Carrying an earlier motion onto the agenda as unfinished business: it names the motion, and
  # says what happened to it
  def carry_motion(item)
    motion = @group.motions.find_by(id: item.motion_id)
    item.motion = motion
    return unless motion

    item.title = "Unfinished: #{motion.title}" if item.title.blank?
    item.kind = "old_business"
    item.details = [motion.status.tr("_", " ").capitalize, motion.decided_on&.strftime("%b %-d, %Y"), motion.committee.presence && "to #{motion.committee}", motion.postponed_to.presence && "until #{motion.postponed_to}"].compact.join(" ") if item.details.blank?
  end

  def tell_record_keepers(item)
    Notification.deliver(@group.record_keepers.where.not(id: current_user.id), kind: "agenda_item.suggested",
                         title: "#{current_user.display_name} suggested an agenda item: #{item.title}",
                         body: "For the business meeting on #{@meeting.held_on.strftime("%b %-d")}.",
                         url: "/groups/#{@group.slug}/conscience/meetings/#{@meeting.id}")
  end
end
