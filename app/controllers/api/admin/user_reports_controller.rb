# Members' reports about people (UserReport): read them with what was written, open the
# group or profile, mark them resolved or reopen, delete.
class Api::Admin::UserReportsController < Api::Admin::SuiteController
  LIMIT = 200

  # GET ?status=open|resolved|all (default open)
  def index
    reports = UserReport.includes(:reporter, :user, :group, :resolved_by).order(created_at: :desc)
    reports = reports.where(status: params[:status].presence || "open") unless params[:status] == "all"
    render json: { total: reports.count, open: UserReport.unresolved.count, limit: LIMIT, reports: reports.limit(LIMIT).map { |r| report_json(r) } }
  end

  # PATCH { status: "resolved" | "open" }
  def update
    report = UserReport.find(params[:id])
    case params[:status]
    when "resolved" then report.resolve!(current_user)
    when "open" then report.reopen!
    else return render json: { error: "Status must be open or resolved." }, status: :unprocessable_entity
    end
    render json: report_json(report.reload)
  end

  def destroy
    UserReport.find(params[:id]).destroy!
    head :no_content
  end

  private

  def person(u) = { name: u.display_name, username: u.username, email: u.email }

  def report_json(r)
    {
      id: r.id, status: r.status, reason: r.reason, quote: r.quote, where: r.where_label,
      created_at: r.created_at.iso8601, resolved_at: r.resolved_at&.iso8601, resolved_by: r.resolved_by&.display_name,
      reporter: person(r.reporter), user: person(r.user),
      group: r.group && { slug: r.group.slug, title: r.group.title },
      still_there: r.subject_type.present? && r.subject_type.constantize.exists?(r.subject_id),
    }
  end
end
