# Readers' reports of problems in book text: review, comment, resolve or reopen.
class Api::Admin::TextReportsController < Api::Admin::SuiteController
  LIMIT = 200

  # GET ?status=open|resolved|all (default open)
  def index
    reports = TextReport.includes(:user, :resolved_by, comments: :user, chapter: :book).order(created_at: :desc)
    reports = reports.where(status: params[:status].presence || "open") unless params[:status] == "all"
    render json: {
      total: reports.count,
      open: TextReport.unresolved.count,
      limit: LIMIT,
      text_reports: reports.limit(LIMIT).map { |r| report_json(r) },
    }
  end

  # PATCH { status: "resolved" | "open" }
  def update
    report = TextReport.find(params[:id])
    case params[:status]
    when "resolved" then report.resolve!(current_user)
    when "open" then report.reopen!
    else return render json: { error: "Status must be open or resolved." }, status: :unprocessable_entity
    end
    render json: report_json(report.reload)
  end

  # POST /:id/comment { body }
  def comment
    report = TextReport.find(params[:id])
    c = report.comments.create(user: current_user, body: params[:body].to_s.strip)
    return render_errors(c) unless c.persisted?

    render json: report_json(report.reload)
  end

  def destroy
    TextReport.find(params[:id]).destroy!
    head :no_content
  end

  private

  def report_json(r)
    chapter = r.chapter
    book = chapter.book
    {
      id: r.id,
      status: r.status,
      message: r.message,
      quote: r.quote,
      created_at: r.created_at.iso8601,
      resolved_at: r.resolved_at&.iso8601,
      resolved_by: r.resolved_by && person(r.resolved_by),
      reporter: person(r.user),
      book: { slug: book.slug, title: book.title },
      chapter: { slug: chapter.slug, title: chapter.title },
      path: r.reader_path,
      comments: r.comments.map { |c| { id: c.id, body: c.body, created_at: c.created_at.iso8601, by: person(c.user) } },
    }
  end

  def person(user)
    user.name.presence || user.email
  end
end
