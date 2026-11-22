# Members' shares on a reading (ReadingShare): the Shares section under it (ReadingShares.jsx).
# Members post under their name or as "A member", edit or delete their own, and the reading's
# poster (or its group's admins, or a site admin) approves or declines them and can turn shares
# off. An anonymous share's writer is never in what this sends to anyone else.
class Api::ReadingSharesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_reading, only: %i[index create setting]
  before_action :set_share, except: %i[index create setting]

  # GET /api/readings/:reading_id/shares -> { shares, can_share, can_moderate, shares_off, pending, grapevine, group, my_name }
  def index
    render json: list_json
  end

  # POST /api/readings/:reading_id/shares { share: { body, anonymous } } -> the share
  def create
    return render(json: { error: "Shares are off for this reading." }, status: :forbidden) if @reading.shares_off
    if ReadingShare.posted_too_often?(current_user)
      return render(json: { error: "You can share #{ReadingShare::PER_HOUR} times an hour. Try again a little later." }, status: :too_many_requests)
    end

    share = @reading.shares.create!(user: current_user, body: share_params[:body].to_s.strip, anonymous: anonymous_param(true))
    share.notify_waiting!
    render json: share.as_api_json(viewer: current_user), status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # PATCH /api/reading_shares/:id { share: { body?, anonymous? } } -> the share (its writer only)
  def update
    return render(json: { error: "Only its writer can change it." }, status: :forbidden) unless @share.mine?(current_user)

    was_pending = @share.pending?
    body = share_params.key?(:body) ? share_params[:body].to_s.strip : @share.body
    @share.revise!(body: body, anonymous: anonymous_param(@share.anonymous))
    @share.notify_waiting! unless was_pending
    render json: @share.as_api_json(viewer: current_user)
  rescue ActiveRecord::RecordInvalid
    render json: { error: @share.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # DELETE /api/reading_shares/:id (its writer, or a site admin)
  def destroy
    return render(json: { error: "You can't delete that share." }, status: :forbidden) unless @share.removable_by?(current_user)

    @share.destroy!
    head :no_content
  end

  # POST /api/reading_shares/:id/approve -> the share
  def approve
    return forbidden unless @share.moderatable_by?(current_user)

    @share.approve!(current_user)
    render json: @share.as_api_json(viewer: current_user)
  end

  # POST /api/reading_shares/:id/decline { reason? } -> the share (also takes down an approved one)
  def decline
    return forbidden unless @share.moderatable_by?(current_user)

    @share.decline!(current_user, params[:reason])
    render json: @share.as_api_json(viewer: current_user)
  end

  # PATCH /api/readings/:reading_id/shares/setting { shares_off } -> the list
  def setting
    return forbidden unless ReadingShare.moderator_of?(@reading, current_user)

    @reading.update_column(:shares_off, ActiveModel::Type::Boolean.new.cast(params[:shares_off]) || false)
    render json: list_json
  end

  private

  def set_reading
    @reading = Reading.find_by(id: params[:reading_id])
    return if @reading && ReadingShare.readable_on?(@reading, current_user)

    render json: { error: "Shares aren't open to you on this reading." }, status: :not_found
  end

  def set_share
    @share = ReadingShare.includes(:reading).find_by(id: params[:id])
    render json: { error: "That share isn't here anymore." }, status: :not_found unless @share&.readable_by?(current_user)
  end

  def share_params = params.fetch(:share, {}).permit(:body, :anonymous)

  def anonymous_param(default)
    return default unless share_params.key?(:anonymous)

    ActiveModel::Type::Boolean.new.cast(share_params[:anonymous]) != false
  end

  def forbidden = render(json: { error: "Only the reading's poster or its group's admins can do that." }, status: :forbidden)

  def list_json
    shares = ReadingShare.shown_to(@reading, current_user).includes(user: { avatar_attachment: :blob }).to_a
    moderator = ReadingShare.moderator_of?(@reading, current_user)
    {
      shares: shares.map { |s| s.as_api_json(viewer: current_user) },
      can_share: !@reading.shares_off, can_moderate: moderator, shares_off: @reading.shares_off,
      pending: (shares.count(&:pending?) if moderator), grapevine: @reading.grapevine?, per_hour: ReadingShare::PER_HOUR,
      group: @reading.group&.title, my_name: current_user.display_name,
    }
  end
end
