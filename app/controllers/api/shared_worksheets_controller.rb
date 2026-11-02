# Opening a worksheet someone shared (StepWork#share!) with its password: POST
# /api/shared_worksheets/:token { password } -> the worksheet and what's written in it, read
# only. A wrong password and a link that doesn't work answer the same way, and tries are
# limited.
class Api::SharedWorksheetsController < ApplicationController
  rate_limit to: 10, within: 10.minutes, by: -> { "#{request.remote_ip}:#{params[:token]}" },
             with: -> { render json: { error: "Too many tries. Wait a few minutes and try again." }, status: :too_many_requests }

  def create
    work = StepWork.find_by(share_token: params[:token].to_s) if params[:token].present?
    unless work&.share_password_digest && work.authenticate_share_password(params[:password].to_s)
      return render(json: { error: "That password isn't right, or this link has been turned off." }, status: :unauthorized)
    end

    work.update_column(:share_viewed_at, Time.current)
    render json: { work: { name: work.name, step: work.step, tool_key: work.tool_key, label: work.label, status: work.status,
                           updated_at: work.updated_at.iso8601, definition: work.definition, answers: work.answers, settings: work.settings,
                           by: work.user.display_name.split.first } }
  end
end
