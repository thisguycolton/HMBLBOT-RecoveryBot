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

  # PATCH { status: "resolved" | "open" } | { shares: "7" | "30" | "forever" | "allow" } | { sponsoring: "stop" | "allow" } (whether the person
  # reported can offer to sponsor: SponsorProfile#stopped_at)
  def update
    report = UserReport.find(params[:id])
    if params[:shares].present?
      # Stop the person reported from sharing on readings for a while, without showing who
      # wrote an anonymous share: "7" or "30" days, "forever", or "allow" to lift it
      until_at = case params[:shares].to_s
                 when "7", "30" then params[:shares].to_i.days.from_now
                 when "forever" then 100.years.from_now
                 when "allow" then nil
                 else return render(json: { error: "Pick 7, 30, forever or allow." }, status: :unprocessable_entity)
                 end
      report.user.update_column(:shares_suspended_until, until_at)
      return render(json: report_json(report.reload))
    end
    if params[:sponsoring].present?
      return render(json: { error: "That share was anonymous." }, status: :unprocessable_entity) if report.anonymous_subject?

      profile = SponsorProfile.for(report.user)
      stop = params[:sponsoring] == "stop"
      profile.update!(stopped_at: (Time.current if stop), stopped_by: (current_user if stop), available: stop ? false : profile.available)
      return render(json: report_json(report.reload))
    end
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

  # An anonymous share's writer stays hidden here too: the admins act on the share, not the person
  def reported(r) = r.anonymous_subject? ? { name: ReadingShare::ANONYMOUS_NAME, username: nil, email: nil, anonymous: true } : person(r.user)

  def report_json(r)
    {
      id: r.id, status: r.status, reason: r.reason, quote: r.quote, where: r.where_label,
      created_at: r.created_at.iso8601, resolved_at: r.resolved_at&.iso8601, resolved_by: r.resolved_by&.display_name,
      reporter: person(r.reporter), user: reported(r),
      reading_path: (r.subject_type == "ReadingShare" && (share = ReadingShare.find_by(id: r.subject_id)) ? "/readings/#{share.reading_id}#shares" : nil),
      group: r.group && { slug: r.group.slug, title: r.group.title },
      share_report: r.subject_type == "ReadingShare",
      shares_suspended_until: (r.user.shares_suspended_until&.iso8601 if r.subject_type == "ReadingShare" && r.user.shares_suspended?),
      still_there: r.subject_type.present? && r.subject_type.constantize.exists?(r.subject_id),
      sponsoring: (r.user.sponsor_profile&.then { |p| p.stopped_at ? "stopped" : (p.available ? "offering" : "off") } unless r.anonymous_subject?),
    }
  end
end
