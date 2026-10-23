# A group's events: everyone who can see the group sees its published events; the people
# editing an event also see it as a draft. Group admins start new ones.
class Api::GroupEventsController < ApplicationController
  include GroupScoped

  skip_before_action :authenticate_user!, only: :index
  before_action :set_viewable_group, only: :index
  before_action :set_group, except: :index
  before_action :require_manager, only: :create

  # GET /api/groups/:group_slug/events -> what's coming up, and past events (newest first) as an archive
  def index
    visible = ->(scope) { scope.with_attached_cover.to_a.select { |e| e.visible_to?(current_user) }.map(&:card_json) }
    render json: {
      can_create: Event.creatable_by?(@group, current_user),
      events: visible.(@group.events.not_past.upcoming_first),
      past_events: visible.(@group.events.past.latest_first),
    }
  end

  # POST /api/groups/:group_slug/events { event: { title } } -> a draft, opened in the editor
  def create
    event = @group.events.new(params.require(:event).permit(:title, :short_description))
    event.assign_attributes(created_by: current_user, time_zone: @group.time_zone, blocks: starter_blocks)
    event.save ? render(json: event.card_json, status: :created) : render_errors(event)
  end

  private

  # Something to start from, so the canvas isn't empty
  def starter_blocks
    [
      { type: "heading", region: "main", text: "About this event", level: 2 },
      { type: "notes", region: "main", markdown: "Tell people what to expect." },
      { type: "agenda", region: "side", view: "list", activities: [] },
    ]
  end
end
