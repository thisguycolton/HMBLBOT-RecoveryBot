# Site Admin > TestFlight requests: people who asked to try the iPhone app (/testflight).
# List them, mark them invited or done (or back to new), delete.
class Api::Admin::TestflightRequestsController < Api::Admin::SuiteController
  LIMIT = 500

  # GET ?status=new|invited|done|all (default new)
  def index
    requests = TestflightRequest.includes(:user, :handled_by).order(created_at: :desc)
    requests = requests.where(status: params[:status].presence || "new") unless params[:status] == "all"
    render json: {
      total: requests.count,
      counts: TestflightRequest.group(:status).count,
      limit: LIMIT,
      testflight_requests: requests.limit(LIMIT).map(&:as_admin_json),
    }
  end

  # PATCH { status: "new" | "invited" | "done" }
  def update
    testflight_request = TestflightRequest.find(params[:id])
    return render json: { error: "Status must be new, invited or done." }, status: :unprocessable_entity unless TestflightRequest::STATUSES.include?(params[:status])

    testflight_request.mark!(params[:status], current_user)
    render json: testflight_request.reload.as_admin_json
  end

  # PATCH { ids: [...], status: } for "Mark all shown as invited"
  def bulk
    return render json: { error: "Status must be new, invited or done." }, status: :unprocessable_entity unless TestflightRequest::STATUSES.include?(params[:status])

    TestflightRequest.where(id: Array(params[:ids])).find_each { |r| r.mark!(params[:status], current_user) }
    head :no_content
  end

  def destroy
    TestflightRequest.find(params[:id]).destroy!
    head :no_content
  end
end
