# Worksheets a sponsor suggests to their sponsees (StepSuggestion): only the worksheet, never
# answers. The sponsee starts it (their own StepWork) or sets it aside; the sponsor can take
# it back.
class Api::StepSuggestionsController < ApplicationController
  before_action :authenticate_user!

  # POST /api/step_suggestions { sponsorship_ids, work_id | tool_key, note }
  def create
    sponsorships = Sponsorship.active.where(sponsor_id: current_user.id, id: Array(params[:sponsorship_ids])).includes(:sponsee).to_a
    return render(json: { error: "Pick a sponsee to suggest it to." }, status: :unprocessable_entity) if sponsorships.empty?

    source = worksheet
    return render(json: { error: "That worksheet isn't here." }, status: :not_found) unless source

    made = sponsorships.map { |s| s.suggestions.create!(**source, note: params[:note]) }
    sponsorships.each do |s|
      Notification.deliver(s.sponsee, kind: "sponsorship.suggestion", from: current_user,
                                      title: "#{current_user.display_name} suggested a worksheet: #{source[:name]}", url: "/recovery/steps")
    end
    render json: { suggestions: made.map(&:as_api_json), sent_to: sponsorships.map { |s| s.sponsee.display_name } }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # POST /api/step_suggestions/:id/start (the sponsee) -> their new worksheet
  def start
    suggestion = mine.find(params[:id])
    work = suggestion.start!(current_user)
    render json: { work: work.as_api_json(full: true) }, status: :created
  end

  # DELETE /api/step_suggestions/:id -> the sponsee sets it aside, or the sponsor takes it back
  def destroy
    suggestion = StepSuggestion.joins(:sponsorship).merge(Sponsorship.active.involving(current_user)).find(params[:id])
    suggestion.destroy!
    head :no_content
  end

  private

  def mine = StepSuggestion.joins(:sponsorship).merge(Sponsorship.active.where(sponsee_id: current_user.id))

  # The worksheet to share, as attributes: one of their own (its definition only) or a built-in
  def worksheet
    if params[:work_id].present?
      w = current_user.step_works.find_by(id: params[:work_id])
      w && { name: w.name, step: w.step, tool_key: w.tool_key, definition: w.definition }
    elsif (tool = StepTool.find(params[:tool_key].to_s))
      { name: tool.name, step: tool.step, tool_key: tool.key, definition: tool.definition }
    end
  end
end
