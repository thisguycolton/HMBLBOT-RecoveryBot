# The write-up page a site notice's toast links to (/notices/:id). Anyone can read a
# switched-on notice that has started, even after it ends; admins can preview any notice.
class NoticesController < ApplicationController
  layout "reader"

  def show
    @notice = SiteNotice.find_by(id: params[:id])
    admin = current_user&.suite_admin?
    visible = @notice && (admin || (@notice.active? && (@notice.starts_at.nil? || @notice.starts_at <= Time.current)))
    return redirect_to(root_path, alert: "That notice isn't available.") unless visible
    return redirect_to(@notice.link_url, allow_other_host: true) if !@notice.write_up? && @notice.link_url.present? && !admin
  end
end
