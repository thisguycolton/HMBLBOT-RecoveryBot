# HostDeck's templates (DeckTemplate): the group's own, the site-wide gallery, and, for site admins,
# the ones groups shared that are waiting to be published. The members the group picked to
# arrange decks (Group#decks_editable_by?) save, share and delete the group's own.
class Api::DeckTemplatesController < ApplicationController
  include GroupScoped

  before_action :set_group
  before_action :require_member
  before_action :require_editor, only: :create
  before_action :set_template, only: %i[update destroy]

  # GET /api/groups/:group_slug/deck_templates
  def index
    admin = current_user.suite_admin?
    json = {
      mine: @group.deck_templates.includes(:group, :created_by).order(updated_at: :desc).map(&:as_api_json),
      gallery: DeckTemplate.published.where.not(group: @group).includes(:group, :created_by).order(published_at: :desc).map(&:as_api_json),
      can_save: @group.decks_editable_by?(current_user), is_site_admin: admin,
    }
    json[:pending] = DeckTemplate.where(gallery: "pending").includes(:group, :created_by).order(:updated_at).map(&:as_api_json) if admin
    render json: json
  end

  # POST /api/groups/:group_slug/deck_templates { deck_template: { name, description, purpose, arrangement, share } }
  def create
    template = @group.deck_templates.new(template_params.merge(created_by: current_user))
    template.gallery = "pending" if share?
    template.save ? render(json: template.as_api_json, status: :created) : render_errors(template)
  end

  # PATCH /api/groups/:group_slug/deck_templates/:id { deck_template: { name, description, share }, review: publish|decline }
  # The group's editors change their own and share or withdraw it; a site admin publishes or declines.
  def update
    if params[:review].present?
      return forbid("Only site admins review the gallery.") unless current_user.suite_admin?

      publish = params[:review] == "publish"
      @template.update!(gallery: publish ? "published" : "declined", reviewed_by: current_user, published_at: (Time.current if publish))
    else
      return forbid unless own?

      @template.assign_attributes(template_params.slice(:name, :description, :purpose))
      @template.gallery = share? ? (@template.gallery == "published" ? "published" : "pending") : "none" unless params.dig(:deck_template, :share).nil?
      return render_errors(@template) unless @template.save
    end
    render json: @template.as_api_json
  end

  # DELETE /api/groups/:group_slug/deck_templates/:id
  def destroy
    return forbid unless own? || current_user.suite_admin?

    @template.destroy!
    head :no_content
  end

  private

  def require_member
    return if @group.member_or_site_admin?(current_user)

    render json: { error: "HostDeck's templates are for the group's members." }, status: :forbidden
  end

  def require_editor
    forbid unless @group.decks_editable_by?(current_user)
  end

  # This group's own (any group's for a site admin reviewing the gallery)
  def set_template
    @template = current_user.suite_admin? ? DeckTemplate.find(params[:id]) : @group.deck_templates.find(params[:id])
  end

  def own? = @template.group_id == @group.id && @group.decks_editable_by?(current_user)
  def share? = ActiveModel::Type::Boolean.new.cast(params.dig(:deck_template, :share))

  def forbid(message = "Only the members the group picked in its settings can change its HostDeck templates.")
    render json: { error: message }, status: :forbidden
  end

  def template_params
    attrs = params.require(:deck_template).permit(:name, :description, :purpose)
    attrs[:arrangement] = params[:deck_template][:arrangement].permit!.to_h if params[:deck_template][:arrangement].respond_to?(:permit!)
    attrs
  end
end
