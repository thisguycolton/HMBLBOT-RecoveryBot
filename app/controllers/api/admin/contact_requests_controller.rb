# Messages from the Contact page (/contact): read them, mark them handled or reopen, delete.
class Api::Admin::ContactRequestsController < Api::Admin::SuiteController
  LIMIT = 200

  # GET ?status=open|handled|all (default open)
  def index
    requests = ContactRequest.includes(:user, :handled_by).order(created_at: :desc)
    requests = requests.where(status: params[:status].presence || "open") unless params[:status] == "all"
    render json: {
      total: requests.count,
      open: ContactRequest.unhandled.count,
      limit: LIMIT,
      contact_requests: requests.limit(LIMIT).map { |r| request_json(r) },
    }
  end

  # PATCH { status: "handled" | "open" }
  def update
    contact_request = ContactRequest.find(params[:id])
    case params[:status]
    when "handled" then contact_request.handle!(current_user)
    when "open" then contact_request.reopen!
    else return render json: { error: "Status must be open or handled." }, status: :unprocessable_entity
    end
    render json: request_json(contact_request.reload)
  end

  def destroy
    ContactRequest.find(params[:id]).destroy!
    head :no_content
  end

  private

  def request_json(r)
    {
      id: r.id,
      status: r.status,
      name: r.name,
      email: r.email,
      topic: r.topic,
      topic_label: r.topic_label,
      message: r.message,
      created_at: r.created_at.iso8601,
      handled_at: r.handled_at&.iso8601,
      handled_by: r.handled_by && (r.handled_by.name.presence || r.handled_by.email),
      account: r.user && { name: r.user.name, email: r.user.email, username: r.user.username },
    }
  end
end
