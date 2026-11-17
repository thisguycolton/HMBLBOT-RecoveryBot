# A member's gratitude lists (GratitudeList), only ever their own
class Api::GratitudeListsController < ApplicationController
  include RecoveryEntries

  private

  def entry_class = GratitudeList
  def entries = current_user.gratitude_lists
  def chip_kind = "gratitude"
  def entry_params = { items: Array(params[:items]).map(&:to_s) }
end
