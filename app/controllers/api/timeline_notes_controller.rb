# Notes on your timeline, which is on your profile (/people/:username). A note is Markdown,
# like a highlight's note, with up to TimelineNote::IMAGES_MAX pictures. `visibility` says
# who sees it on your profile (new notes take your default from settings); sharing it to
# groups you're in also shows it to their members in the group page's Timeline block.
class Api::TimelineNotesController < ApplicationController
  include GroupScoped

  before_action :require_profiles
  before_action :set_note, only: %i[update destroy]

  # GET /api/timeline_notes -> your notes, newest first, and the groups you can share to
  def index
    notes = current_user.timeline_notes.includes(:groups, images_attachments: :blob, user: { avatar_attachment: :blob }).newest_first.limit(200)
    render json: {
      notes: notes.map { |n| n.as_api_json(viewer: current_user) },
      groups: current_user.groups.order(:title).map { |g| { slug: g.slug, title: g.title } },
      max: TimelineNote::BODY_MAX,
    }
  end

  # POST /api/timeline_notes (multipart when pictures come along)
  # note: body, visibility, group_slugs[], images[]
  def create
    problem = TimelineNote.upload_problem(uploads)
    return render(json: { error: problem }, status: :unprocessable_entity) if problem

    note = current_user.timeline_notes.new(body: note_params[:body].to_s.strip,
                                           visibility: visibility_param || current_user.default_note_visibility)
    note.images.attach(uploads) if uploads.any?
    TimelineNote.transaction do
      note.save!
      note.share_to!(share_groups) if note_params.key?(:group_slugs)
    end
    render json: note.as_api_json(viewer: current_user), status: :created
  rescue ActiveRecord::RecordInvalid
    render_errors(note)
  end

  # PATCH /api/timeline_notes/:id (multipart when pictures come along)
  # note: body, visibility, group_slugs[], images[] (added), remove_image_ids[] -> any of them
  def update
    removing = @note.images.attachments.where(id: Array(note_params[:remove_image_ids]).map(&:to_i)).to_a
    body = note_params.key?(:body) ? note_params[:body].to_s.strip : @note.body
    kept = @note.images.attachments.size - removing.size + uploads.size
    problem = TimelineNote.upload_problem(uploads, already: kept - uploads.size)
    problem ||= "Write something or add a picture" if body.blank? && kept.zero?
    return render(json: { error: problem }, status: :unprocessable_entity) if problem

    TimelineNote.transaction do
      @note.body = body
      @note.visibility = visibility_param if visibility_param
      @note.save!
      @note.share_to!(share_groups) if note_params.key?(:group_slugs)
    end
    # On a saved note, attach saves right away (and the pictures were checked above)
    @note.images.attach(uploads) if uploads.any?
    removing.each(&:purge_later)
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

  def require_profiles
    return if User.profiles_open_to?(current_user)

    render json: { error: "Profiles aren't open yet." }, status: :forbidden
  end

  def set_note
    @note = current_user.timeline_notes.find(params[:id])
  end

  def note_params
    params.require(:note).permit(:body, :visibility, group_slugs: [], images: [], remove_image_ids: [])
  end

  def visibility_param
    note_params[:visibility] if Visibility::LEVELS.include?(note_params[:visibility])
  end

  def uploads
    @uploads ||= Array(note_params[:images]).select { |f| f.respond_to?(:content_type) }
  end

  # Only groups you're in; others are left out
  def share_groups
    current_user.groups.where(slug: Array(note_params[:group_slugs]).reject(&:blank?)).to_a
  end
end
