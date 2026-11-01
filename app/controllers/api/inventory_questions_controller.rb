# The member's own 10th step questions (InventoryQuestions): GET them with the starting sets,
# PATCH { questions } to change them, or { reset: true } for the Big Book's again. Nights
# already written keep their own questions, except the night named by `apply_to` (the one
# they're on), which takes the new ones.
class Api::InventoryQuestionsController < ApplicationController
  before_action :authenticate_user!

  def show = render(json: payload)

  def update
    list = ActiveModel::Type::Boolean.new.cast(params[:reset]) ? [] : InventoryQuestions.clean(params[:questions])
    return render(json: { error: "Keep at least one question." }, status: :unprocessable_entity) if list.empty? && !ActiveModel::Type::Boolean.new.cast(params[:reset])

    current_user.update!(inventory_questions: InventoryQuestions.default?(list) ? nil : list)
    if (on = StepInventory.parse_day(params[:apply_to]))
      current_user.step_inventories.where(on: on).update_all(questions: InventoryQuestions.for(current_user))
    end
    render json: payload
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  private

  def payload
    { questions: InventoryQuestions.for(current_user), custom: current_user.inventory_questions.present?,
      templates: InventoryQuestions::TEMPLATES, max: InventoryQuestions::MAX }
  end
end
