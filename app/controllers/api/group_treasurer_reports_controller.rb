# The treasurer's monthly reports (app/models/treasurer_report.rb). Members read the posted
# ones; the treasurer and record keepers write them as drafts and post them; group admins delete.
class Api::GroupTreasurerReportsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :require_treasurer, only: %i[create update]
  before_action :require_manager, only: :destroy
  before_action :set_report, only: %i[update destroy]

  # GET /api/groups/:group_slug/treasurer_reports
  def index
    render json: { reports: TreasurerReport.visible_to(@group, current_user).newest_first.map(&:as_api_json),
                   can_edit: @group.treasury_editable_by?(current_user), can_delete: @group.manageable_by?(current_user) }
  end

  # POST /api/groups/:group_slug/treasurer_reports
  def create
    report = @group.treasurer_reports.new(report_params.merge(created_by: current_user))
    report.save ? render(json: report.as_api_json, status: :created) : render_errors(report)
  end

  # PATCH /api/groups/:group_slug/treasurer_reports/:id
  def update
    @report.update(report_params) ? render(json: @report.as_api_json) : render_errors(@report)
  end

  # DELETE /api/groups/:group_slug/treasurer_reports/:id
  def destroy
    @report.destroy!
    head :no_content
  end

  private

  def require_treasurer
    return if @group.treasury_editable_by?(current_user)

    render json: { error: "Only the group's treasurer and record keepers can do that." }, status: :forbidden
  end

  def set_report
    @report = @group.treasurer_reports.find(params[:id])
  end

  def report_params
    params.require(:treasurer_report).permit(:period_on, :opening_cents, :reserve_cents, :notes, :status, :visibility,
                                             lines: %i[kind label cents], splits: %i[label percent])
  end
end
