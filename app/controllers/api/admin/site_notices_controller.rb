# Site-wide notices (SiteNotice) for the admin suite's Notices page.
class Api::Admin::SiteNoticesController < Api::Admin::SuiteController
  def index
    render json: SiteNotice.includes(:user).order(created_at: :desc).map(&:as_admin_json)
  end

  def create
    notice = SiteNotice.new(notice_params.merge(user: current_user))
    notice.save ? render(json: notice.as_admin_json, status: :created) : render_errors(notice)
  end

  def update
    notice = SiteNotice.find(params[:id])
    notice.update(notice_params) ? render(json: notice.as_admin_json) : render_errors(notice)
  end

  def destroy
    SiteNotice.find(params[:id]).destroy!
    head :no_content
  end

  private

  def notice_params
    params.require(:site_notice).permit(:title, :summary, :body, :tone, :link_url, :link_label,
                                        :audience, :active, :starts_at, :ends_at)
  end
end
