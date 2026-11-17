# A member's nightly 10th step inventories (StepInventory), only ever their own
class Api::StepInventoriesController < ApplicationController
  include RecoveryEntries

  private

  def entry_class = StepInventory
  def entries = current_user.step_inventories
  def chip_kind = "inventory"

  def entry_params
    answers = params[:answers].respond_to?(:to_unsafe_h) ? params[:answers].to_unsafe_h : {}
    { answers: answers, notes: params[:notes].to_s }
  end
end
