# Comments on timeline notes (NoteComment): anyone who can see a note comments on it in
# Markdown and reacts to comments; writers edit or delete their own, and a note's author
# deletes any on their note. A comment on a repost goes to the original.
class Api::NoteCommentsController < ApplicationController
  include GroupScoped
  include Reacting

  before_action :require_profiles
  before_action :set_note, only: :create
  before_action :set_comment, except: :create

  # POST /api/timeline_notes/:timeline_note_id/comments  body -> the comment
  def create
    comment = @note.comments.create!(user: current_user, body: params[:body].to_s.strip)
    if @note.user_id != current_user.id
      Notification.deliver(@note.user, kind: "note.comment", title: "#{current_user.display_name} commented on your note",
                                       body: comment.body, url: @note.page_path)
    end
    comment.mention!(current_user)
    render json: comment.as_api_json(viewer: current_user), status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # PATCH /api/note_comments/:id  body -> the comment (its writer only)
  def update
    return render(json: { error: "Only its writer can change it." }, status: :forbidden) unless @comment.user_id == current_user.id

    @comment.update!(body: params[:body].to_s.strip)
    @comment.mention!(current_user)
    render json: comment_json
  rescue ActiveRecord::RecordInvalid
    render json: { error: @comment.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # DELETE /api/note_comments/:id (its writer or the note's author)
  def destroy
    return render(json: { error: "You can't delete that comment." }, status: :forbidden) unless @comment.removable_by?(current_user)

    @comment.destroy!
    head :no_content
  end

  # PUT /api/note_comments/:id/reaction  kind: like|love|hugs -> the comment
  def react
    @reactable = @comment
    save_reaction(what: "comment", url: @comment.timeline_note.user.profile_path) { render json: comment_json }
  end

  # DELETE /api/note_comments/:id/reaction -> the comment
  def unreact
    @reactable = @comment
    remove_reaction { render json: comment_json }
  end

  private

  def require_profiles
    return if User.profiles_open_to?(current_user)

    render json: { error: "Profiles aren't open yet." }, status: :forbidden
  end

  def set_note
    note = TimelineNote.find_by(id: params[:timeline_note_id])
    note = note.repost_of if note&.repost?
    return @note = note if note&.visible_to?(current_user)

    render json: { error: "That note isn't here anymore." }, status: :not_found
  end

  def set_comment
    @comment = NoteComment.includes(timeline_note: :groups).find_by(id: params[:id])
    render json: { error: "That comment isn't here anymore." }, status: :not_found unless @comment&.visible_to?(current_user)
  end

  def comment_json
    NoteComment.includes(user: { avatar_attachment: :blob }, reactions: { user: { avatar_attachment: :blob } }).find(@comment.id).as_api_json(viewer: current_user)
  end
end
