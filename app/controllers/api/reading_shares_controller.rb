# Members' shares on a reading (ReadingShare): the Shares section under it (ReadingShares.jsx).
# Members post under their name or as "A member", edit or delete their own, and the reading's
# poster (or its group's admins, or a site admin) approves or declines them and can turn shares
# off. An anonymous share's writer is never in what this sends to anyone else.
class Api::ReadingSharesController < ApplicationController
  before_action :authenticate_user!
  before_action :set_reading, only: %i[index create setting unmute_all]
  before_action :set_share, except: %i[index create setting unmute_all]

  # GET /api/readings/:reading_id/shares -> { shares, can_share, can_moderate, shares_off, pending, grapevine, group, my_name }
  def index
    render json: list_json
  end

  # POST /api/readings/:reading_id/shares { share: { body, anonymous, parent_id?, also_timeline?, from_note_id?, delete_note? } }
  # -> the share. parent_id makes it a reply to a share; also_timeline (named shares only) posts
  # it to their timeline too, as a note linking back to the reading. from_note_id + delete_note:
  # "Move to the reading's shares" on a note of theirs, which deletes the note once it's moved.
  def create
    return render(json: { error: "Shares are off for this reading." }, status: :forbidden) if @reading.shares_off
    if current_user.shares_suspended?
      return render(json: { error: "You can't share on readings right now. A site admin paused it after a report." }, status: :forbidden)
    end
    if ReadingShare.posted_too_often?(current_user)
      return render(json: { error: "You can share #{ReadingShare::PER_HOUR} times an hour. Try again a little later." }, status: :too_many_requests)
    end

    parent = nil
    if share_params[:parent_id].present?
      parent = @reading.shares.find_by(id: share_params[:parent_id])
      return render(json: { error: "That share isn't here anymore." }, status: :not_found) unless parent&.approved? && parent.readable_by?(current_user)
    end

    share = @reading.shares.create!(user: current_user, parent: parent, body: share_params[:body].to_s.strip, anonymous: anonymous_param(true))
    share.approved? ? share.notify_reply! : share.notify_waiting!
    post_to_timeline(share) if !share.anonymous? && !share.reply? && ActiveModel::Type::Boolean.new.cast(share_params[:also_timeline])
    remove_moved_note if ActiveModel::Type::Boolean.new.cast(share_params[:delete_note])
    render json: share.as_api_json(viewer: current_user), status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # PATCH /api/reading_shares/:id { share: { body?, anonymous? } } -> the share (its writer only)
  def update
    return render(json: { error: "Only its writer can change it." }, status: :forbidden) unless @share.mine?(current_user)
    return render(json: { error: "You can't share on readings right now." }, status: :forbidden) if current_user.shares_suspended? && share_params.key?(:body)

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

  # PUT /api/reading_shares/:id/reaction { kind: like|love|hugs } -> the share. Only approved
  # ones; the writer hears someone reacted, never who.
  def react
    return render(json: { error: "You can react once it's approved." }, status: :unprocessable_entity) unless @share.approved?

    kind = params[:kind].to_s
    return render(json: { error: "Pick Like, Love or Hugs." }, status: :unprocessable_entity) unless NoteReaction::KINDS.include?(kind)

    reaction = @share.reactions.find_or_initialize_by(user: current_user)
    first = reaction.new_record?
    reaction.update!(kind: kind)
    @share.notify_reaction!(current_user) if first
    render json: fresh_json
  rescue ActiveRecord::RecordNotUnique
    retry
  end

  # DELETE /api/reading_shares/:id/reaction -> the share
  def unreact
    @share.reactions.where(user: current_user).delete_all
    render json: fresh_json
  end

  # POST /api/reading_shares/:id/mute: hide this person's shares and replies from me, named or
  # anonymous, without being told who they are
  def mute
    return render(json: { error: "That's your own share." }, status: :unprocessable_entity) if @share.mine?(current_user)

    ShareMute.find_or_create_by!(user: current_user, muted_user_id: @share.user_id)
    head :no_content
  rescue ActiveRecord::RecordNotUnique
    head :no_content
  end

  # DELETE /api/readings/:reading_id/shares/mutes: unmute everyone -> the list
  def unmute_all
    current_user.share_mutes.delete_all
    render json: list_json
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

  def share_params = params.fetch(:share, {}).permit(:body, :anonymous, :parent_id, :also_timeline, :from_note_id, :delete_note)

  # A note of theirs moved here: deleted only if it's theirs (and with it its reposts and comments)
  def remove_moved_note
    current_user.timeline_notes.find_by(id: share_params[:from_note_id])&.destroy
  end

  def fresh_json = ReadingShare.includes(:reactions, user: { avatar_attachment: :blob }).find(@share.id).as_api_json(viewer: current_user)

  # "Also post to my timeline": a note of theirs quoting the share, with a link back, seen by
  # whoever their new notes usually go to (Settings > Privacy)
  def post_to_timeline(share)
    url = "#{request.base_url}/readings/#{share.reading_id}"
    current_user.timeline_notes.create!(body: "#{share.body}\n\nOn the reading [#{share.reading.title}](#{url})".first(TimelineNote::BODY_MAX),
                                        visibility: current_user.default_note_visibility)
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.info("[reading_share] timeline note not posted: #{e.message}")
  end

  def anonymous_param(default)
    return default unless share_params.key?(:anonymous)

    ActiveModel::Type::Boolean.new.cast(share_params[:anonymous]) != false
  end

  def forbidden = render(json: { error: "Only the reading's poster or its group's admins can do that." }, status: :forbidden)

  def list_json
    shares = ReadingShare.shown_to(@reading, current_user)
    ActiveRecord::Associations::Preloader.new(records: shares, associations: [:reactions, { user: { avatar_attachment: :blob } }]).call
    moderator = ReadingShare.moderator_of?(@reading, current_user)
    {
      shares: shares.map { |s| s.as_api_json(viewer: current_user) },
      can_share: !@reading.shares_off && !current_user.shares_suspended?, can_moderate: moderator, shares_off: @reading.shares_off,
      pending: (shares.count(&:pending?) if moderator), muted: current_user.share_mutes.count,
      suspended: current_user.shares_suspended?, grapevine: @reading.grapevine?, per_hour: ReadingShare::PER_HOUR,
      group: @reading.group&.title, my_name: current_user.display_name,
    }
  end
end
