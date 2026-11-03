# /worksheet/print/:token: one of a member's worksheets laid out for paper (PrintableWorksheet),
# which opens the print window. The token (StepWork#print_token) is good for 30 minutes. It's
# for the home screen app on iPhones and iPads, which can't print: the app opens this page in a
# Safari view, where printing works, and that view may not be signed in. Never cached or indexed.
class StepWorkPrintsController < ApplicationController
  layout "reader"
  after_action { response.headers["X-Robots-Tag"] = "noindex, nofollow" }
  after_action { response.headers["Referrer-Policy"] = "no-referrer" }
  after_action { response.headers["Cache-Control"] = "no-store" }

  def show
    @work = StepWork.from_print_token(params[:token])
    render :expired, status: :gone unless @work
  end
end
