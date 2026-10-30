# Notes on your timeline, which is on your profile (/people/:username). A note is Markdown,
# like a highlight's note, with up to TimelineNote::IMAGES_MAX pictures. `visibility` says
# who sees it on your profile (new notes take your default from settings); sharing it to
# groups you're in also shows it to their members in the group page's Timeline block.
#
# Anyone who can see a note (TimelineNote#visible_to?) reacts to it, comments on it
# (Api::NoteCommentsController), and reposts it to their own timeline when its author
# shares it with Members. A repost only changes who sees it. `link_url` is the link whose
# preview (LinkPreview) the note shows, or blank for none. `profile` (a username) writes it on
# that person's page instead (TimelineNote#profile). @ mentions tell people (Mentionable).
class Api::TimelineNotesController < ApplicationController
  include GroupScoped
  include Reacting

  before_action :require_profiles
  before_action :set_note, only: :update
  before_action :set_removable_note, only: :destroy
  before_action :set_visible_note, only: %i[react unreact repost unrepost]

  # GET /api/timeline_notes -> your notes, newest first, and the groups you can share to
  def index
    notes = current_user.timeline_notes.for_feed.newest_first.limit(200)
    render json: {
      notes: notes.map { |n| n.as_api_json(viewer: current_user) },
      groups: current_user.groups.order(:title).map { |g| { slug: g.slug, title: g.title } },
      max: TimelineNote::BODY_MAX,
    }
  end

  # POST /api/timeline_notes (multipart when pictures come along)
  # note: body, visibility, group_slugs[], images[], link_url, chip_id (one of your chips, with
  # today: YYYY-MM-DD, your date, for which chips you have), profile (a username: on their page)
  def create
    problem = TimelineNote.upload_problem(uploads)
    return render(json: { error: problem }, status: :unprocessable_entity) if problem

    note = current_user.timeline_notes.new(body: note_params[:body].to_s.strip,
                                           visibility: visibility_param || current_user.default_note_visibility)
    if note_params[:chip_id].present?
      note.chip = TimelineNote.chip_for(current_user, note_params[:chip_id], StepInventory.parse_day(note_params[:today]) || Date.current)
      return render(json: { error: "That isn't one of your chips." }, status: :unprocessable_entity) unless note.chip

      note.chip_id = note.chip["id"]
    end
    if note_params[:profile].present?
      note.profile = User.find_by(username: note_params[:profile].to_s.downcase)
      return render(json: { error: "That person isn't here." }, status: :not_found) unless note.profile
    end
    note.images.attach(uploads) if uploads.any?
    note.link_url = note_params[:link_url] if note_params.key?(:link_url)
    TimelineNote.transaction do
      note.save!
      note.share_to!(share_groups) if note_params.key?(:group_slugs)
    end
    note.tell_profile!
    note.mention!(current_user)
    render json: note.as_api_json(viewer: current_user), status: :created
  rescue ActiveRecord::RecordInvalid
    render_errors(note)
  end

  # PATCH /api/timeline_notes/:id (multipart when pictures come along)
  # note: body, visibility, group_slugs[], images[] (added), remove_image_ids[], link_url -> any of them
  def update
    return update_repost if @note.repost?

    removing = @note.images.attachments.where(id: Array(note_params[:remove_image_ids]).map(&:to_i)).to_a
    body = note_params.key?(:body) ? note_params[:body].to_s.strip : @note.body
    kept = @note.images.attachments.size - removing.size + uploads.size
    problem = TimelineNote.upload_problem(uploads, already: kept - uploads.size)
    problem ||= "Write something or add a picture" if body.blank? && kept.zero? && !@note.chip_id
    return render(json: { error: problem }, status: :unprocessable_entity) if problem

    TimelineNote.transaction do
      @note.body = body
      @note.visibility = visibility_param if visibility_param
      @note.link_url = note_params[:link_url] if note_params.key?(:link_url)
      @note.save!
      @note.share_to!(share_groups) if note_params.key?(:group_slugs)
    end
    # On a saved note, attach saves right away (and the pictures were checked above)
    @note.images.attach(uploads) if uploads.any?
    removing.each(&:purge_later)
    @note.mention!(current_user)
    render json: TimelineNote.for_feed.find(@note.id).as_api_json(viewer: current_user)
  rescue ActiveRecord::RecordInvalid
    render_errors(@note)
  end

  # DELETE /api/timeline_notes/:id -> gone from your timeline and every group's (whoever's page
  # it was written on can take it off too)
  def destroy
    @note.destroy!
    head :no_content
  end

  # PUT /api/timeline_notes/:id/reaction  kind: like|love|hugs -> the note. Reacting again changes it.
  def react
    @reactable = @note
    save_reaction(what: "note", url: @note.user.profile_path) { render json: note_json }
  end

  # DELETE /api/timeline_notes/:id/reaction -> the note
  def unreact
    @reactable = @note
    remove_reaction { render json: note_json }
  end

  # POST /api/timeline_notes/:id/repost  visibility -> the repost, now on your timeline
  def repost
    repost = current_user.timeline_notes.find_by(repost_of: @note) ||
             current_user.timeline_notes.create!(repost_of: @note, body: "", visibility: repost_visibility)
    if repost.previously_new_record?
      Notification.deliver(@note.user, kind: "note.repost", title: "#{current_user.display_name} reposted your note",
                                       body: @note.body.to_s.truncate(120), url: current_user.profile_path)
    end
    render json: TimelineNote.for_feed.find(repost.id).as_api_json(viewer: current_user), status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  # DELETE /api/timeline_notes/:id/repost -> the note, off your timeline
  def unrepost
    current_user.timeline_notes.where(repost_of: @note).destroy_all
    render json: note_json
  end

  private

  # Reposts keep the original's words; only who sees them changes
  def update_repost
    @note.update!(visibility: visibility_param) if visibility_param
    render json: @note.as_api_json(viewer: current_user)
  rescue ActiveRecord::RecordInvalid
    render_errors(@note)
  end

  # The note to react to or repost (a repost's original), if the viewer can see it
  def set_visible_note
    note = TimelineNote.find_by(id: params[:id])
    note = note.repost_of if note&.repost?
    return @note = note if note&.visible_to?(current_user)

    render json: { error: "That note isn't here anymore." }, status: :not_found
  end

  def note_json = TimelineNote.for_feed.find(@note.id).as_api_json(viewer: current_user)

  # Who sees a new repost: as asked, or your followers unless you share notes with Members by default
  def repost_visibility
    return params[:visibility] if Visibility::LEVELS.include?(params[:visibility])

    current_user.default_note_visibility == "public" ? "public" : "followers"
  end

  def require_profiles
    return if User.profiles_open_to?(current_user)

    render json: { error: "Profiles aren't open yet." }, status: :forbidden
  end

  def set_note
    @note = current_user.timeline_notes.find(params[:id])
  end

  def set_removable_note
    @note = TimelineNote.where(user_id: current_user.id).or(TimelineNote.where(profile_id: current_user.id)).find(params[:id])
  end

  def note_params
    params.require(:note).permit(:body, :visibility, :link_url, :chip_id, :today, :profile, group_slugs: [], images: [], remove_image_ids: [])
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
