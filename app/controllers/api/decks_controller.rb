# A group's decks of its own (Deck: a business meeting's, host onboarding...), for its members.
# The members the group picked (Group#decks_editable_by?) make, change and lay them out; anyone
# in the group runs them, and the page checks in every few seconds (ping) like a meeting's
# HostDeck does (Api::GroupHostingController).
class Api::DecksController < ApplicationController
  include GroupScoped

  # What a deck does on its own (a meeting's acts that need a meeting aren't here)
  ACTS = %w[goto complete uncomplete block clock_start clock_reset].freeze

  before_action :set_group
  before_action :require_member
  before_action :set_deck, except: %i[index create]
  before_action :require_editor, only: %i[create update destroy arrangement]

  # GET /api/groups/:group_slug/decks?document_id=: the group's decks (run from that document);
  # with a document, also the meetings whose script it is
  def index
    decks = @group.decks.order(updated_at: :desc)
    decks = decks.where(script_document_id: params[:document_id]) if params[:document_id].present?
    decks = decks.includes(:group).to_a
    documents = GroupDocument.visible_to(@group, current_user).where(id: decks.filter_map(&:script_document_id)).pluck(:id, :title).to_h
    json = { decks: decks.map { |d| d.as_list_json(documents: documents) }, can_create: @group.decks_editable_by?(current_user), can_host: @group.can_host?(current_user) }
    if params[:document_id].present?
      kits = @group.hosting_kits.where(script_document_id: params[:document_id]).includes(:meeting)
      json[:meetings] = kits.map { |k| k.meeting ? { id: k.meeting.id, name: k.meeting.name } : { id: nil, name: "All the group's meetings" } }
    end
    json[:meeting_choices] = @group.meetings.ordered.map { |m| { id: m.id, name: m.name, schedule_label: m.schedule_label } }.uniq { |m| m[:name] }
    render json: json
  end

  # POST /api/groups/:group_slug/decks { deck: { name, purpose, script_document_id } }
  def create
    deck = @group.decks.new(deck_params.merge(created_by: current_user))
    deck.save ? render(json: deck.as_list_json, status: :created) : render_errors(deck)
  end

  # GET /api/groups/:group_slug/decks/:id
  def show
    render json: center
  end

  # PATCH /api/groups/:group_slug/decks/:id { deck: { name, purpose, script_document_id } }
  def update
    @deck.update(deck_params) ? render(json: DeckCenter.new(@deck.reload, current_user)) : render_errors(@deck)
  end

  # DELETE /api/groups/:group_slug/decks/:id
  def destroy
    @deck.destroy!
    head :no_content
  end

  # PUT /api/groups/:group_slug/decks/:id/arrangement { arrangement }
  def arrangement
    @deck.update!(arrangement: params.require(:arrangement).permit!.to_h)
    render json: DeckCenter.new(@deck.reload, current_user)
  end

  # POST /api/groups/:group_slug/decks/:id/ping { activity, section_index }
  def ping
    presence = center.session.presences.find_or_initialize_by(user: current_user)
    presence.update!(activity: params[:activity], section_index: params[:section_index].presence&.to_i, last_seen_at: Time.current)
    render json: center.session.live_json(current_user).merge(layout_key: center.layout_key)
  end

  # POST /api/groups/:group_slug/decks/:id/act { act, index, label, data }
  def act
    act = params[:act].to_s
    return render(json: { error: "That isn't something a deck does." }, status: :unprocessable_entity) unless ACTS.include?(act)

    data = params[:data].respond_to?(:permit) ? params[:data].permit(:block_id, :op, :item).to_h : {}
    center.session.act!(act, user: current_user, index: params[:index], label: params[:label], data: data)
    render json: center.session.live_json(current_user)
  end

  private

  def require_member
    return if @group.member_or_site_admin?(current_user)

    render json: { error: "Decks are for the group's members." }, status: current_user ? :forbidden : :unauthorized
  end

  def require_editor
    return if @group.decks_editable_by?(current_user)

    render json: { error: "Only the members the group picked in its settings can make or change decks." }, status: :forbidden
  end

  def set_deck = @deck = @group.decks.find(params[:id])
  def center = @center ||= DeckCenter.new(@deck, current_user)

  def deck_params
    attrs = params.require(:deck).permit(:name, :purpose, :script_document_id)
    attrs[:script_document_id] = @group.documents.find_by(id: attrs[:script_document_id])&.id if attrs.key?(:script_document_id)
    attrs
  end
end
