# Who holds a service position, and when (record keepers). Starting someone's term ends the one
# before it the day before, so a rotation is one entry.
class Api::GroupServiceTermsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :require_keeper
  before_action :set_position
  before_action :set_term, only: %i[update destroy]

  # POST /api/groups/:group_slug/service_positions/:service_position_id/terms { term: { name, user_id, starts_on, ends_on } }
  def create
    term = @position.terms.new(term_params)
    ServiceTerm.transaction do
      if term.valid?
        @position.terms.where("service_terms.starts_on < ? AND (service_terms.ends_on IS NULL OR service_terms.ends_on >= ?)", term.starts_on, term.starts_on)
                 .update_all(ends_on: term.starts_on - 1.day)
        term.save!
      end
    end
    term.persisted? ? render(json: position_json, status: :created) : render_errors(term)
  end

  # PATCH .../terms/:id
  def update
    @term.update(term_params) ? render(json: position_json) : render_errors(@term)
  end

  # DELETE .../terms/:id
  def destroy
    @term.destroy!
    render json: position_json
  end

  private

  def set_position
    @position = @group.service_positions.find(params[:service_position_id])
  end

  def set_term
    @term = @position.terms.find(params[:id])
  end

  # A holder can be linked to a member, so they hear when their term is up
  def term_params
    attrs = params.require(:term).permit(:name, :user_id, :starts_on, :ends_on)
    attrs[:user_id] = nil unless attrs[:user_id].present? && @group.members.exists?(attrs[:user_id])
    attrs
  end

  def position_json
    @position.reload.as_api_json(today: @group.zone.today)
  end
end
