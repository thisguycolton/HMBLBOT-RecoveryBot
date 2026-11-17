# Chips someone gave the member that they haven't seen in the "you got a chip" popup yet
# (ChipArrival, on every page; ChipsChannel tells open pages when one comes).
class Api::ChipArrivalsController < ApplicationController
  before_action :authenticate_user!

  # Older ones than this just wait on the Chips page
  WITHIN = 30.days

  # GET /api/chip_arrivals -> { chips: [...] } (oldest first), in Chips.catalog's shape
  def index
    awards = scope.includes(:given_by, group: { logo_attachment: :blob }).order(:claimed_at, :id).limit(10)
    render json: { chips: awards.map { |a| a.as_chip_json.merge(title: a.arrival_title) } }
  end

  # POST /api/chip_arrivals/:id/seen -> shown once; its bell notification is read too
  def seen
    award = current_user.chip_awards.claimed.find(params[:id])
    award.celebrated!
    head :no_content
  end

  private

  def scope = current_user.chip_awards.claimed.where(celebrated_at: nil, claimed_at: WITHIN.ago..)
end
