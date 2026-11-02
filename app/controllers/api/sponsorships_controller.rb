# Sponsorship (/recovery/sponsorship): a member's sponsors and sponsees, asking someone to be
# their sponsor, saying yes or no when asked, their invite link, and ending one. Everything
# here is between the two people in it.
class Api::SponsorshipsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_sponsorship, only: %i[accept decline update destroy shares nudge]

  # GET /api/sponsorships
  def index
    mine = Sponsorship.involving(current_user).includes(:sponsor, :sponsee)
    active = mine.active.order(:started_on, :id).to_a
    unseen = SponsorshipShare.where(sponsorship_id: active.select { |s| s.sponsor_id == current_user.id }.map(&:id), seen_at: nil)
                             .group(:sponsorship_id).count
    render json: {
      sponsors: active.select { |s| s.sponsee_id == current_user.id }.map { |s| s.as_api_json(current_user) },
      sponsees: active.select { |s| s.sponsor_id == current_user.id }.map { |s| s.as_api_json(current_user).merge(unseen: unseen[s.id] || 0) },
      asking_me: mine.pending.where(sponsor_id: current_user.id).order(:created_at).map { |s| s.as_api_json(current_user) },
      my_asks: mine.where(sponsee_id: current_user.id, status: %w[pending declined]).where(created_at: 30.days.ago..)
                   .order(created_at: :desc).map { |s| s.as_api_json(current_user) },
      invite_url: (invite_url_for(current_user.sponsor_invite_token) if current_user.sponsor_invite_token.present?),
      note_max: Sponsorship::NOTE_MAX, reply_max: SponsorshipShare::REPLY_MAX,
    }
  end

  # POST /api/sponsorships { username, note } -> asks them to be your sponsor
  def create
    sponsor = User.where(confirmed: true).find_by(username: params[:username].to_s.strip.delete_prefix("@").downcase)
    return render(json: { error: "There's nobody here with that username. It's the name after /people/ on their page." }, status: :not_found) unless sponsor

    sponsorship = Sponsorship.ask!(sponsee: current_user, sponsor: sponsor, note: params[:note])
    render json: { sponsorship: sponsorship.as_api_json(current_user) }, status: :created
  rescue Sponsorship::Refused => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  # POST /api/sponsorships/:id/accept (the person asked)
  def accept
    return not_yours unless @sponsorship.pending? && @sponsorship.sponsor_id == current_user.id

    @sponsorship.accept!
    render json: { sponsorship: @sponsorship.as_api_json(current_user) }
  end

  # POST /api/sponsorships/:id/decline (the person asked). The asker isn't told.
  def decline
    return not_yours unless @sponsorship.pending? && @sponsorship.sponsor_id == current_user.id

    @sponsorship.decline!(current_user)
    head :no_content
  end

  # PATCH /api/sponsorships/:id { current_step } -> the step the sponsee is on (either of them;
  # blank clears it). The other person is told when the sponsor sets it.
  def update
    return not_yours unless @sponsorship.active?

    @sponsorship.update!(current_step: params[:current_step].presence)
    if @sponsorship.current_step && @sponsorship.sponsor_id == current_user.id
      Notification.deliver(@sponsorship.sponsee, kind: "sponsorship.step", from: current_user,
                                                 title: "#{current_user.display_name} marked you on Step #{@sponsorship.current_step}", url: "/recovery/steps")
    end
    render json: { sponsorship: @sponsorship.as_api_json(current_user) }
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # POST /api/sponsorships/:id/nudge { note } (the sponsor) -> checks in on the sponsee's step work
  def nudge
    return not_yours unless @sponsorship.active? && @sponsorship.sponsor_id == current_user.id

    @sponsorship.nudge!(params[:note])
    render json: { sponsorship: @sponsorship.as_api_json(current_user) }
  rescue Sponsorship::Refused => e
    render json: { error: e.message }, status: :unprocessable_entity
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # DELETE /api/sponsorships/:id -> ends it (either of them), takes back an ask, or clears a
  # declined one off the asker's list
  def destroy
    if @sponsorship.status == "declined"
      return not_yours unless @sponsorship.sponsee_id == current_user.id

      @sponsorship.destroy!
    else
      @sponsorship.end!(current_user)
    end
    head :no_content
  end

  # GET /api/sponsorships/:id/shares -> what the sponsee sent, newest first. The sponsor
  # opening it marks it all seen.
  def shares
    return not_yours unless @sponsorship.active?

    rows = @sponsorship.shares.order(created_at: :desc).to_a
    @sponsorship.shares.where(seen_at: nil).update_all(seen_at: Time.current) if @sponsorship.sponsor_id == current_user.id
    render json: { sponsorship: @sponsorship.as_api_json(current_user), shares: rows.map(&:as_api_json),
                   suggestions: @sponsorship.suggestions.order(created_at: :desc).map(&:as_api_json) }
  end

  # POST /api/sponsorships/invite { reset } -> your invite link (a new one with reset, and the
  # old one stops working)
  def invite
    current_user.update_column(:sponsor_invite_token, nil) if ActiveModel::Type::Boolean.new.cast(params[:reset])
    render json: { invite_url: invite_url_for(current_user.sponsor_invite_token!) }
  end

  # GET /api/sponsorships/invite/:token -> who it's from
  def show_invite
    sponsor = invite_sponsor or return
    render json: { sponsor: sponsor.as_person_json, own: sponsor == current_user,
                   already: Sponsorship.active.exists?(sponsor: sponsor, sponsee: current_user) }
  end

  # POST /api/sponsorships/invite/:token -> they're your sponsor
  def accept_invite
    sponsor = invite_sponsor or return
    sponsorship = Sponsorship.accept_invite!(sponsee: current_user, sponsor: sponsor)
    render json: { sponsorship: sponsorship.as_api_json(current_user) }, status: :created
  rescue Sponsorship::Refused => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def set_sponsorship
    @sponsorship = Sponsorship.involving(current_user).where(status: %w[pending active declined]).find_by(id: params[:id])
    not_yours unless @sponsorship
  end

  def invite_sponsor
    sponsor = params[:token].present? && User.find_by(sponsor_invite_token: params[:token].to_s)
    return sponsor if sponsor

    render json: { error: "That link isn't working any more. Ask them for a new one." }, status: :not_found
    nil
  end

  def invite_url_for(token) = "#{request.base_url}/sponsor/#{token}"

  def not_yours = render(json: { error: "That isn't one of yours." }, status: :not_found)
end
