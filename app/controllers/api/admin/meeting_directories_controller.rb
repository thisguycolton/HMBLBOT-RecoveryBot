# Local meeting lists (MeetingDirectory) for the admin suite's Meeting lists page: add a
# list, preview an import from its feed or a file, then import (MeetingListImport).
class Api::Admin::MeetingDirectoriesController < Api::Admin::SuiteController
  FETCH_ERRORS = [OiaaFeed::Error, MeetingListImport::Error, SocketError, SystemCallError, Net::OpenTimeout, Net::ReadTimeout,
                  OpenSSL::SSL::SSLError, URI::InvalidURIError, ArgumentError].freeze

  rescue_from(*FETCH_ERRORS) { |e| render json: { error: e.message }, status: :unprocessable_entity }

  def index
    render json: MeetingDirectory.includes(:imported_by).order(:name).map(&:as_admin_json)
  end

  def create
    directory = MeetingDirectory.new(directory_params)
    directory.save ? render(json: directory.as_admin_json, status: :created) : render_errors(directory)
  end

  def update
    directory = MeetingDirectory.find(params[:id])
    directory.update(directory_params.except(:key)) ? render(json: directory.as_admin_json) : render_errors(directory)
  end

  # Only an empty list (one never imported, or whose listings were all removed)
  def destroy
    directory = MeetingDirectory.find(params[:id])
    directory.destroy ? head(:no_content) : render_errors(directory)
  end

  # POST /api/admin/meeting_directories/:id/preview { url? | text? } -> MeetingListImport#preview
  def preview
    render json: import.preview
  end

  # POST /api/admin/meeting_directories/:id/import { url? | text?, keys: [...], hide: [...] }
  def import_listings
    result = import.apply!(keys: params[:keys], hide: params[:hide], user: current_user)
    render json: result.merge(directory: import.directory.reload.as_admin_json)
  end

  private

  def import
    @import ||= MeetingListImport.new(MeetingDirectory.find(params[:id]), url: params[:url], text: params[:text])
  end

  def directory_params
    params.require(:meeting_directory).permit(:name, :key, :feed_url, :website, :time_zone)
  end
end
