# Site Admin > App releases: each build of the iPhone and Android apps, its release notes, and
# whether it's out to testers yet (AppRelease). Also gives Site notices the "how to update" notice
# for the latest build out on each platform.
class Api::Admin::AppReleasesController < Api::Admin::SuiteController
  def index
    render json: {
      app_releases: AppRelease.order(:platform, build: :desc).map(&:as_admin_json),
      update_notices: AppRelease::PLATFORMS.index_with do |platform|
        release = AppRelease.latest(platform) || AppRelease.where(platform: platform).newest_first.first
        release && release.update_steps.merge(build: release.build, released: release.released?)
      end,
    }
  end

  def create
    release = AppRelease.new(release_params)
    release.save ? render(json: release.as_admin_json, status: :created) : render_errors(release)
  end

  def update
    release = AppRelease.find(params[:id])
    release.update(release_params) ? render(json: release.as_admin_json) : render_errors(release)
  end

  def destroy
    AppRelease.find(params[:id]).destroy!
    head :no_content
  end

  private

  def release_params
    params.require(:app_release).permit(:platform, :build, :version, :notes, :released_on)
  end
end
