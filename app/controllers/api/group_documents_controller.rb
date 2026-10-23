# A group's documents (app/models/group_document.rb): the meeting format, guidelines,
# treasurer's reports and the like. Who sees which is GroupDocument.visible_to: visitors get
# Public ones (so a group's page can show its format), members the Members ones too, record
# keepers everything. Keepers (Group#records_editable_by?) write; group admins delete.
class Api::GroupDocumentsController < ApplicationController
  include GroupScoped

  skip_before_action :authenticate_user!, only: %i[index show file]
  before_action :set_viewable_group, only: %i[index show file]
  before_action :set_group, except: %i[index show file]
  before_action :set_document, only: %i[show file update destroy versions version restore]
  before_action :require_keeper, only: %i[create update restore bulk]
  before_action :require_manager, only: :destroy
  before_action :require_member, only: %i[versions version]

  # GET /api/groups/:group_slug/documents?q=
  def index
    docs = GroupDocument.visible_to(@group, current_user)
    docs = GroupDocument.search(docs, params[:q]) if params[:q].present?
    docs = docs.with_attached_file.includes(:updated_by, :created_by).ordered
    render json: { documents: docs.map { |d| d.as_api_json(viewer: current_user) }, can_edit: keeper?, can_delete: @group.manageable_by?(current_user) }
  end

  # GET /api/groups/:group_slug/documents/:id
  def show
    render json: document_json
  end

  # GET /api/groups/:group_slug/documents/:id/file(?version_id=&download=1) -> the upload
  def file
    attached = params[:version_id].present? ? member_version&.file : @document.file
    return render(json: { error: "Not found." }, status: :not_found) unless attached&.attached?

    name = attached.filename.to_s
    type = GroupDocument.file_type_for(name) or return render(json: { error: "Not found." }, status: :not_found)
    inline = GroupDocument::INLINE_TYPES.include?(type) && !ActiveModel::Type::Boolean.new.cast(params[:download])
    send_data attached.download, filename: name, type: type, disposition: inline ? "inline" : "attachment"
  end

  # POST /api/groups/:group_slug/documents (multipart when a file comes along)
  def create
    @document = @group.documents.new(created_by: current_user)
    return render_errors(@document) unless @document.revise(document_params, current_user, message: params[:message])

    render json: document_json, status: :created
  end

  # PATCH /api/groups/:group_slug/documents/:id { document: {...}, message: "what changed" }
  # A change to the title, text or file is saved as a new version with that note
  def update
    @document.revise(document_params, current_user, message: params[:message]) ? render(json: document_json) : render_errors(@document)
  end

  # DELETE /api/groups/:group_slug/documents/:id (group admins)
  def destroy
    @document.destroy!
    head :no_content
  end

  BULK_ACTIONS = %w[move visibility pin unpin archive unarchive delete].freeze

  # POST /api/groups/:group_slug/documents/bulk { ids: [], do: "move" (value: a folder) |
  # "visibility" (value) | "pin" | "unpin" | "archive" | "unarchive" | "delete" } -> { updated: n }
  # (deleting is for group admins, as one at a time is)
  def bulk
    action = params[:do].to_s
    return render(json: { error: "Pick something to do." }, status: :unprocessable_entity) unless BULK_ACTIONS.include?(action)
    return render(json: { error: "Only this group's admins can delete documents." }, status: :forbidden) if action == "delete" && !@group.manageable_by?(current_user)

    docs = @group.documents.where(id: Array(params[:ids]))
    value = params[:value].to_s
    now = Time.current
    n = case action
        when "move"
          return render(json: { error: "That isn't a folder." }, status: :unprocessable_entity) unless GroupDocument::KINDS.include?(value)

          docs.update_all(kind: value, updated_at: now)
        when "visibility"
          return render(json: { error: "That isn't a visibility." }, status: :unprocessable_entity) unless GroupDocument::VISIBILITIES.include?(value)

          docs.update_all(visibility: value, updated_at: now)
        when "pin" then docs.update_all(pinned: true, updated_at: now)
        when "unpin" then docs.update_all(pinned: false, updated_at: now)
        when "archive" then docs.update_all(status: "archived", updated_at: now)
        when "unarchive" then docs.where(status: "archived").update_all(status: "current", updated_at: now)
        when "delete" then docs.destroy_all.size
        end
    render json: { updated: n }
  end

  # GET /api/groups/:group_slug/documents/:id/versions -> its versions, newest (the document as it is) first, without their text
  def versions
    list = @document.versions.with_attached_file.includes(:user, :restored_from).to_a
    people = User.where(id: list.flat_map(&:contributor_ids).uniq).index_by(&:id)
    render json: { versions: list.map { |v| v.as_api_json(people: people) } }
  end

  # GET /api/groups/:group_slug/documents/:id/versions/:version_id -> one version with its text
  def version
    v = @document.versions.find(params[:version_id])
    render json: v.as_api_json(people: User.where(id: v.contributor_ids).index_by(&:id), full: true)
  end

  # POST /api/groups/:group_slug/documents/:id/versions/:version_id/restore { message }
  def restore
    version = @document.versions.find(params[:version_id])
    @document.restore(version, current_user, message: params[:message]) ? render(json: document_json) : render_errors(@document)
  end

  private

  def set_document
    @document = GroupDocument.visible_to(@group, current_user).find(params[:id])
  end

  def member_version
    @document.versions.find_by(id: params[:version_id]) if @group.member_or_site_admin?(current_user)
  end

  def document_json
    template = GroupDocumentTemplate.for(@group, @document.kind)
    @document.as_api_json(viewer: current_user, full: true).merge(can_edit: keeper?, can_delete: @group.manageable_by?(current_user),
                                                                  can_comment: @document.commentable_by?(current_user),
                                                                  letterhead: template.blank? ? nil : template.as_api_json)
  end

  def document_params
    attrs = params.require(:document).permit(:title, :kind, :body, :body_format, :visibility, :status, :pinned, :file, :remove_file, :approved_by_motion_id, :comment_mode)
    # A new upload with no title takes its file's name
    if attrs[:title].blank? && attrs[:file].respond_to?(:original_filename) && @document&.title.blank?
      attrs[:title] = File.basename(attrs[:file].original_filename, ".*").tr("_-", " ")
    end
    attrs
  end
end
