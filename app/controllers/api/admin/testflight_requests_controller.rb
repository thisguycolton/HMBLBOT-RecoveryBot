# Site Admin > Tester requests: people who asked to try the iPhone or Android app (/testflight).
# List them, mark them invited or done (or back to new), delete.
class Api::Admin::TestflightRequestsController < Api::Admin::SuiteController
  LIMIT = 500

  # GET ?status=new|invited|done|all (default new)&platform=ios|android (default both)
  def index
    scope = TestflightRequest.all
    scope = scope.where(platform: params[:platform]) if TestflightRequest::PLATFORMS.include?(params[:platform])
    counts = scope.group(:status).count
    requests = scope.includes(:user, :handled_by).order(created_at: :desc)
    requests = requests.where(status: params[:status].presence || "new") unless params[:status] == "all"
    render json: {
      total: requests.count,
      counts: counts,
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

  # POST: email the person how to join again (TesterMailer), for someone who lost the first one
  def resend
    testflight_request = TestflightRequest.find(params[:id])
    return render json: { error: "Mark them invited first." }, status: :unprocessable_entity if testflight_request.status == "new"

    TesterMailer.with(testflight_request: testflight_request).invited.deliver_later
    render json: testflight_request.as_admin_json
  end

  def destroy
    TestflightRequest.find(params[:id]).destroy!
    head :no_content
  end
end
