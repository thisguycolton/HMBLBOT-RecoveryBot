# Worksheets a group publishes for its members (GroupStepTool), from a worksheet of the
# publisher's own: only the worksheet, never answers. Hosts and admins publish; the publisher
# or an admin removes. Members start their own copy from Steps (POST /api/step_works
# { group_tool_id }).
class Api::GroupStepToolsController < ApplicationController
  before_action :authenticate_user!

  # POST /api/group_step_tools { group_slug, work_id | tool_key, summary }
  def create
    group = current_user.groups.find_by(slug: params[:group_slug].to_s)
    return render(json: { error: "Only that group's hosts and admins can share worksheets with it." }, status: :forbidden) unless group && GroupStepTool.publishable_by?(group, current_user)

    source = if params[:work_id].present?
               current_user.step_works.find_by(id: params[:work_id])
             else
               StepTool.find(params[:tool_key].to_s)
             end
    return render(json: { error: "That worksheet isn't here." }, status: :not_found) unless source

    tool = group.step_tools.create!(created_by: current_user, name: source.name, step: source.step, definition: source.definition,
                                    tool_key: source.is_a?(StepWork) ? source.tool_key : source.key, summary: params[:summary])
    render json: { tool: tool.as_api_json(current_user) }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def destroy
    tool = GroupStepTool.where(group: current_user.groups).find(params[:id])
    return render(json: { error: "Only whoever shared it or a group admin can take it down." }, status: :forbidden) unless tool.removable_by?(current_user)

    tool.destroy!
    head :no_content
  end
end
