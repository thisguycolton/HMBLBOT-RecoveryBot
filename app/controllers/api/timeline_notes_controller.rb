# Your own timeline (/groups/timeline): notes only you see until you share them to groups
# you're in, where members see them in the group page's Timeline block.
class Api::TimelineNotesController < ApplicationController
  include GroupScoped

  before_action :require_groups
  before_action :set_note, only: %i[update destroy]

  # GET /api/timeline_notes -> your notes, newest first, and the groups you can share to
  def index
    notes = current_user.timeline_notes.includes(:groups, user: { avatar_attachment: :blob }).newest_first.limit(200)
    render json: {
      notes: notes.map { |n| n.as_api_json(viewer: current_user) },
      groups: current_user.groups.order(:title).map { |g| { slug: g.slug, title: g.title } },
      max: TimelineNote::BODY_MAX,
    }
  end

  # POST /api/timeline_notes { note: { body, group_slugs: [] } }
  def create
    note = current_user.timeline_notes.new(body: note_params[:body])
    TimelineNote.transaction do
      note.save!
      note.share_to!(share_groups)
    end
    render json: note.as_api_json(viewer: current_user), status: :created
  rescue ActiveRecord::RecordInvalid
    render_errors(note)
  end

  # PATCH /api/timeline_notes/:id { note: { body, group_slugs } } -> either, or both
  def update
    TimelineNote.transaction do
      @note.update!(body: note_params[:body]) if note_params.key?(:body)
      @note.share_to!(share_groups) if note_params.key?(:group_slugs)
    end
    render json: @note.reload.as_api_json(viewer: current_user)
  rescue ActiveRecord::RecordInvalid
    render_errors(@note)
  end

  # DELETE /api/timeline_notes/:id -> gone from your timeline and every group's
  def destroy
    @note.destroy!
    head :no_content
  end

  private

  def require_groups
    return if Group.feature_open_to?(current_user) || current_user.group_memberships.exists?

    render json: { error: "Groups isn't open yet." }, status: :forbidden
  end

  def set_note
    @note = current_user.timeline_notes.find(params[:id])
  end

  def note_params
    params.require(:note).permit(:body, group_slugs: [])
  end

  # Only groups you're in; others are left out
  def share_groups
    current_user.groups.where(slug: Array(note_params[:group_slugs])).to_a
  end
end
