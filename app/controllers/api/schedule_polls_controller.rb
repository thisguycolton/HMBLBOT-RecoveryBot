# Schedule polls (app/models/schedule_poll.rb). Admins create them; the organizer and
# collaborators run them; anyone with the link can vote.
class Api::SchedulePollsController < ApplicationController
  before_action :authenticate_user!, only: %i[index create update destroy close reopen people remove_ballot]
  before_action :set_poll, except: %i[index create people]
  before_action :require_manager, only: %i[update close reopen remove_ballot]

  # GET /api/schedule_polls -> the polls you organize, help run or were asked to vote in
  def index
    polls = SchedulePoll.for_user(current_user).includes(:user, :members).order(created_at: :desc)
    render json: {
      can_create: current_user.suite_admin?,
      polls: polls.map do |poll|
        role = poll.user_id == current_user.id ? "organizer" : poll.members.find { |m| m.user_id == current_user.id }&.role
        { token: poll.token, title: poll.title, starts_on: poll.starts_on.iso8601, ends_on: poll.ends_on.iso8601,
          closes_at: poll.closes_at.in_time_zone(poll.zone).strftime("%Y-%m-%dT%H:%M"), closed: poll.closed?,
          ballots_count: poll.ballots.size, role: role }
      end,
    }
  end

  # GET /api/schedule_polls/:token
  def show
    render json: poll_json
  end

  # POST /api/schedule_polls
  def create
    return render(json: { error: "Only admins can make schedule polls for now." }, status: :forbidden) unless current_user.suite_admin?

    @poll = current_user.schedule_polls.new
    save_poll(status: :created)
  end

  # PATCH /api/schedule_polls/:token
  def update
    save_poll
  end

  # DELETE /api/schedule_polls/:token (the organizer only)
  def destroy
    return render(json: { error: "Only the organizer can delete this poll." }, status: :forbidden) unless @poll.deletable_by?(current_user)

    @poll.destroy!
    head :no_content
  end

  # POST /api/schedule_polls/:token/close
  def close
    @poll.update!(closed_at: Time.current)
    render json: poll_json
  end

  # POST /api/schedule_polls/:token/reopen
  def reopen
    @poll.update!(closed_at: nil)
    render json: poll_json
  end

  # PUT /api/schedule_polls/:token/ballot { choices: ["2026-10-16T19:00", ...], voter_name }
  def vote
    return render(json: { error: "Voting has closed." }, status: :unprocessable_entity) if @poll.closed?

    ballot = viewer_ballot
    if ballot.nil?
      ip = SchedulePollBallot.ip_digest(request.remote_ip)
      if current_user.nil? && @poll.ballots.where(user_id: nil, ip_digest: ip).exists?
        return render(json: { error: "Someone on this network has already voted in this poll. Sign in to vote too." },
                      status: :unprocessable_entity)
      end
      ballot = @poll.ballots.new(user: current_user, voter_token: voter_token, ip_digest: ip)
    end
    first_vote = ballot.new_record?
    ballot.choices = Array(params[:choices]).map(&:to_s)
    ballot.voter_name = params[:voter_name].to_s.strip.first(60) if params.key?(:voter_name)
    ballot.save!
    @viewer_ballot = ballot

    if first_vote
      @poll.notify_organizers(kind: "schedule_poll.vote", title: "#{ballot.display_name} voted in “#{@poll.title}”",
                              except: current_user)
    end
    render json: poll_json
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotUnique
    render json: { error: "You've already voted in this poll." }, status: :unprocessable_entity
  end

  # DELETE /api/schedule_polls/:token/ballot (take back your own vote)
  def unvote
    return render(json: { error: "Voting has closed." }, status: :unprocessable_entity) if @poll.closed?

    viewer_ballot&.destroy!
    @viewer_ballot = nil
    render json: poll_json
  end

  # DELETE /api/schedule_polls/:token/ballots/:id (organizers removing a ballot)
  def remove_ballot
    @poll.ballots.find(params[:id]).destroy!
    render json: poll_json
  end

  # GET /api/schedule_polls/people?q=ann -> accounts to tag
  def people
    unless current_user.suite_admin? || SchedulePollMember.collaborators.exists?(user: current_user)
      return render(json: { error: "Not allowed." }, status: :forbidden)
    end

    q = "%#{User.sanitize_sql_like(params[:q].to_s.strip)}%"
    users = User.where(confirmed: true).where("name ILIKE :q OR email ILIKE :q", q: q).order(:name, :email).limit(8)
    render json: users.map { |u| { user_id: u.id, name: u.name.presence || u.email.split("@").first, email: u.email } }
  end

  private

  def set_poll
    @poll = SchedulePoll.includes(:user, members: :user).find_by!(token: params[:token] || params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: { error: "That poll doesn't exist." }, status: :not_found
  end

  def require_manager
    return if @poll.manager?(current_user)

    render json: { error: "Only the poll's organizers can do that." }, status: :forbidden
  end

  def voter_token
    token = cookies.signed[:hb_voter]
    return token if token.present?

    token = SecureRandom.hex(16)
    cookies.permanent.signed[:hb_voter] = { value: token, httponly: true, same_site: :lax }
    token
  end

  def viewer_ballot
    return @viewer_ballot if defined?(@viewer_ballot)

    @viewer_ballot =
      (current_user && @poll.ballots.find_by(user: current_user)) ||
      (cookies.signed[:hb_voter] && @poll.ballots.find_by(voter_token: cookies.signed[:hb_voter])).then do |ballot|
        # A ballot cast before signing in becomes the account's
        ballot.update!(user: current_user) if ballot && current_user && ballot.user_id.nil?
        ballot
      end
  end

  def poll_json
    @poll.reload
    ballot = viewer_ballot
    @poll.as_api_json(viewer: current_user, ballot: ballot, include_results: @poll.results_visible_to?(current_user, ballot)).merge(
      my_ballot: ballot && { choices: ballot.choices, voter_name: ballot.voter_name },
      signed_in: current_user.present?,
      my_name: current_user && (current_user.name.presence || current_user.email.split("@").first)
    )
  end

  def save_poll(status: :ok)
    attrs = params.require(:poll).permit(
      :title, :description, :time_zone, :starts_on, :ends_on, :duration_minutes, :choices_count, :slot_minutes,
      :day_start_minute, :day_end_minute, :results_visibility, :closes_at, blocks: %i[kind date start end label]
    )
    closes_at = attrs.delete(:closes_at)
    SchedulePoll.transaction do
      @poll.assign_attributes(attrs)
      zone = ActiveSupport::TimeZone[@poll.time_zone.presence || "America/Phoenix"]
      @poll.closes_at = closes_at.present? ? zone&.parse(closes_at) : (@poll.ends_on && zone&.local(@poll.ends_on.year, @poll.ends_on.month, @poll.ends_on.day).end_of_day)
      @poll.closed_at = nil if @poll.closes_at_changed? && @poll.closes_at.to_i > Time.current.to_i
      @poll.save!
      sync_members if params[:poll].key?(:members)
    end
    render json: poll_json, status: status
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def sync_members
    wanted = Array(params[:poll][:members]).to_h do |m|
      [m[:user_id].to_i, SchedulePollMember::ROLES.include?(m[:role]) ? m[:role] : "invitee"]
    end
    wanted.delete(@poll.user_id)
    @poll.members.where.not(user_id: wanted.keys).destroy_all
    wanted.each do |user_id, role|
      member = @poll.members.find_or_initialize_by(user_id: user_id)
      next unless User.exists?(id: user_id)

      member.update!(role: role)
    end
  end
end
