# Comments in the margin of a group document (GroupDocumentComment), with replies. They're off
# unless the document turns them on (GroupDocument#comment_mode): then its editors, or every member
# who can see it, read and write them (GroupDocument#commentable_by?). Writers change or delete
# their own; the comment's writer and the document's editors resolve a thread; group admins
# delete any.
class Api::GroupDocumentCommentsController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :set_document
  before_action :set_comment, only: %i[update destroy]

  # GET /api/groups/:group_slug/documents/:document_id/comments -> { comments: [threads], can_resolve }
  def index
    threads = @document.comments.threads.includes(:user, :version, :resolved_by, replies: :user).order(:created_at, :id)
    render json: { comments: threads.map { |c| comment_json(c) }, can_resolve: keeper? }
  end

  # POST .../comments { body, quote, prefix, suffix } or { body, parent_id } -> the thread
  def create
    parent = @document.comments.threads.find(params[:parent_id]) if params[:parent_id].present?
    comment = @document.comments.new(user: current_user, parent: parent, body: params[:body])
    unless parent
      return render(json: { error: "Pick the words you're commenting on." }, status: :unprocessable_entity) if params[:quote].blank?

      comment.assign_attributes(quote: params[:quote], prefix: params[:prefix], suffix: params[:suffix], version: @document.head)
    end
    return render_errors(comment) unless comment.save

    parent&.update!(resolved_at: nil, resolved_by: nil) if parent&.resolved?
    notify(comment, parent)
    render json: comment_json(parent || comment), status: :created
  end

  # PATCH .../comments/:id { body } (its writer) or { resolved: true|false } (the thread's writer, or an editor)
  def update
    if params.key?(:resolved)
      return render(json: { error: "Only replies' threads are resolved." }, status: :unprocessable_entity) if @comment.parent_id
      return render(json: { error: "You can't resolve that comment." }, status: :forbidden) unless @comment.user_id == current_user.id || keeper?

      resolved = ActiveModel::Type::Boolean.new.cast(params[:resolved])
      @comment.update!(resolved_at: resolved ? Time.current : nil, resolved_by: resolved ? current_user : nil)
    else
      return render(json: { error: "Only its writer can change it." }, status: :forbidden) unless @comment.user_id == current_user.id
      return render_errors(@comment) unless @comment.update(body: params[:body])
    end
    render json: comment_json(@comment.parent || @comment)
  end

  # DELETE .../comments/:id (its writer or a group admin); a thread goes with its replies
  def destroy
    return render(json: { error: "You can't delete that comment." }, status: :forbidden) unless @comment.user_id == current_user.id || @group.manageable_by?(current_user)

    @comment.destroy!
    head :no_content
  end

  private

  def set_document
    @document = GroupDocument.visible_to(@group, current_user).find(params[:document_id])
    return if @document.commentable_by?(current_user)

    render json: { error: @document.comment_mode == "off" ? "Comments are off for this document." : "Only this document's editors can comment on it." }, status: :forbidden
  end

  def set_comment
    @comment = @document.comments.find(params[:id])
  end

  def comment_json(comment) = comment.as_api_json(viewer: current_user, can_moderate: @group.manageable_by?(current_user))

  # A new comment tells whoever last saved the document and its writer; a reply tells everyone
  # in the thread. Never the person writing, nor anyone who can't comment on it any more.
  def notify(comment, parent)
    people = if parent
               User.where(id: [parent.user_id, *parent.replies.pluck(:user_id)])
             else
               User.where(id: [@document.updated_by_id, @document.created_by_id])
             end
    people = people.where.not(id: current_user.id).select { |u| @document.commentable_by?(u) && GroupDocument.visible_to(@group, u).exists?(@document.id) }
    return if people.empty?

    title = parent ? "#{current_user.display_name} replied to a comment on “#{@document.title}”" : "#{current_user.display_name} commented on “#{@document.title}”"
    Notification.deliver(people, kind: "document.comment", title: title, body: comment.body,
                                 url: "/groups/#{@group.slug}/conscience/documents/#{@document.id}?comment=#{parent&.id || comment.id}")
  end
end
