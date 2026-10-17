# The Topicificator's old admin pages (topic sets, categories, topic forms) now live in the
# React admin at /admin_panel/topicificator. These controllers keep their JSON (other code
# reads it) and send browsers to the React admin; writes need an admin.
module TopicificatorAdminPages
  extend ActiveSupport::Concern

  private

  # redirect_to_admin("sets"), redirect_to_admin(topic_set_id: 3)
  def redirect_to_admin(path = nil, **query)
    redirect_to admin_panel_topicificator_path(path: path.presence, **query)
  end

  def require_topicificator_admin!
    return if current_user&.admin?
    respond_to do |format|
      format.json { render json: { error: "Admins only" }, status: :forbidden }
      format.html { redirect_to root_path, alert: "Access denied!" }
    end
  end
end
