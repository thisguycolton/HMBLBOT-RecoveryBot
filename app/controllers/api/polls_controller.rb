# Polls (app/models/poll.rb). Site admins, and a group's admins, record keepers and hosts, make
# them; the people running a poll edit, close and reopen it; whoever its audience allows votes.
class Api::PollsController < ApplicationController
  before_action :authenticate_user!, only: %i[index create update destroy close reopen remove_ballot groups subject]
  before_action :set_poll, except: %i[index create groups subject]
  before_action :require_manager, only: %i[update destroy close reopen remove_ballot]

  # GET /api/polls -> polls you made, or run for a group
  def index
    polls = Poll.made_by(current_user).includes(:group, :ballots).order(created_at: :desc).limit(200)
    render json: {
      can_create: current_user.suite_admin? || creatable_groups.any?,
      polls: polls.map do |p|
        { token: p.token, question: p.question, closed: p.closed?, closes_at: p.closes_at&.iso8601,
          ballots_count: p.ballots.size, group: p.group&.title, audience: p.audience, created_at: p.created_at.iso8601 }
      end,
    }
  end

  # GET /api/polls/groups -> the groups you can make a poll for
  def groups
    render json: { site_admin: current_user.suite_admin?, groups: creatable_groups.map { |g| { id: g.id, name: g.title } } }
  end

  # GET /api/polls/subject?type=Reading&id=12 -> what a new poll would be attached to
  def subject
    subject = Poll.find_subject(params[:type], params[:id])
    return render(json: { error: "That isn't there anymore." }, status: :not_found) unless subject
    return render(json: { error: "You can't add a poll to that." }, status: :forbidden) unless Poll.attachable_to?(subject, current_user)

    title = subject.is_a?(Reading) ? (subject.title.presence || subject.meetingName) : subject.title
    render json: { type: subject.class.name, id: subject.id, title: title, group: subject.group && { id: subject.group.id, name: subject.group.title },
                   path: subject.is_a?(Reading) ? "/readings/#{subject.id}" : "/groups/#{subject.group.slug}/conscience/decisions?open=#{subject.id}" }
  end

  # GET /api/polls/:token
  def show
    render json: poll_json
  end

  # POST /api/polls
  def create
    if params.dig(:poll, :subject_type).present?
      subject = Poll.find_subject(params[:poll][:subject_type], params[:poll][:subject_id])
      unless Poll.attachable_to?(subject, current_user)
        return render(json: { error: "You can't add a poll to that." }, status: :forbidden)
      end

      @poll = Poll.new(user: current_user, group: subject.group, subject: subject)
      return save_poll(status: :created)
    end

    group = params.dig(:poll, :group_id).presence && Group.find_by(id: params[:poll][:group_id])
    unless Poll.creatable_by?(current_user, group)
      return render(json: { error: group ? "You can't make polls for that group." : "Pick one of your groups for this poll." }, status: :forbidden)
    end

    @poll = Poll.new(user: current_user, group: group)
    save_poll(status: :created)
  end

  # PATCH /api/polls/:token
  def update
    save_poll
  end

  # DELETE /api/polls/:token
  def destroy
    @poll.destroy!
    head :no_content
  end

  # POST /api/polls/:token/close
  def close
    @poll.update!(closed_at: Time.current)
    render json: poll_json
  end

  # POST /api/polls/:token/reopen
  def reopen
    @poll.update!(closed_at: nil, closes_at: (@poll.closes_at if @poll.closes_at&.future?))
    render json: poll_json
  end

  # PUT /api/polls/:token/ballot { option_ids: [..], voter_name }
  def vote
    ballot = viewer_ballot
    problem = ballot ? (@poll.closed? ? "Voting has closed." : nil) : @poll.vote_problem(current_user)
    return render(json: { error: problem }, status: :unprocessable_entity) if problem

    if ballot.nil?
      ip = PollBallot.ip_digest(request.remote_ip)
      if current_user.nil? && @poll.ballots.where(user_id: nil, ip_digest: ip).exists?
        return render(json: { error: "Someone on this network has already voted in this poll as a guest. Sign in to vote too." },
                      status: :unprocessable_entity)
      end
      ballot = @poll.ballots.new(user: current_user, voter_token: voter_token, ip_digest: ip)
    end
    ballot.option_ids = Array(params[:option_ids]).map(&:to_i)
    ballot.voter_name = params[:voter_name].to_s.squish.first(60).presence if params.key?(:voter_name) && current_user.nil?
    ballot.save!
    @viewer_ballot = ballot
    render json: poll_json
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  rescue ActiveRecord::RecordNotUnique
    render json: { error: "You've already voted in this poll." }, status: :unprocessable_entity
  end

  # DELETE /api/polls/:token/ballot (take back your own vote)
  def unvote
    return render(json: { error: "Voting has closed." }, status: :unprocessable_entity) if @poll.closed?

    viewer_ballot&.destroy!
    @viewer_ballot = nil
    render json: poll_json
  end

  # DELETE /api/polls/:token/ballots/:id (the people running it removing a vote)
  def remove_ballot
    @poll.ballots.find(params[:id]).destroy!
    render json: poll_json
  end

  private

  def creatable_groups
    @creatable_groups ||= Group.where(id: GroupMembership.active.where(user: current_user).select(:group_id)).order(:title)
                               .select { |g| Poll.creatable_by?(current_user, g) }
  end

  def set_poll
    @poll = Poll.includes(:group, :options).find_by!(token: params[:token].to_s.downcase)
  rescue ActiveRecord::RecordNotFound
    render json: { error: "That poll doesn't exist." }, status: :not_found
  end

  def require_manager
    return if @poll.manager?(current_user)

    render json: { error: "Only the people running this poll can do that." }, status: :forbidden
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
      (cookies.signed[:hb_voter].presence && @poll.ballots.find_by(voter_token: cookies.signed[:hb_voter])).then do |ballot|
        # A guest vote cast before signing in becomes the account's
        ballot.update!(user: current_user, voter_name: nil) if ballot && current_user && ballot.user_id.nil?
        ballot
      end
  end

  def poll_json
    @poll.reload
    ballot = viewer_ballot
    @poll.as_api_json(viewer: current_user, ballot: ballot).merge(
      my_ballot: ballot && { option_ids: ballot.option_ids, voter_name: ballot.voter_name },
      signed_in: current_user.present?,
      my_name: current_user&.display_name,
      group_id: @poll.group_id
    )
  end

  def save_poll(status: :ok)
    attrs = params.require(:poll).permit(:question, :details, :max_choices, :audience, :results_visibility, :voters_visibility, :closes_at)
    Poll.transaction do
      @poll.assign_attributes(attrs.except(:closes_at))
      if attrs.key?(:closes_at)
        @poll.closes_at = attrs[:closes_at].present? ? Time.zone.parse(attrs[:closes_at].to_s) : nil
        @poll.closed_at = nil if @poll.closes_at_changed? && @poll.closes_at&.future?
      end
      sync_options if params[:poll].key?(:options)
      @poll.save!
    end
    render json: poll_json, status: status
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  # options: [{ id?, label }] in order; answers left out are removed, along with their votes
  def sync_options
    wanted = Array(params[:poll][:options]).map { |o| o.respond_to?(:permit) ? o.permit(:id, :label) : {} }
    keep_ids = wanted.filter_map { |o| o[:id].presence&.to_i }
    @poll.options.each { |o| o.mark_for_destruction unless keep_ids.include?(o.id) }
    wanted.each_with_index do |o, i|
      option = o[:id].present? ? @poll.options.find { |x| x.id == o[:id].to_i } : @poll.options.build
      next unless option

      option.label = o[:label]
      option.position = i
    end
    removed = @poll.options.select(&:marked_for_destruction?).map(&:id)
    return if removed.empty? || @poll.new_record?

    # Votes for a removed answer lose it; a ballot left with nothing is dropped
    @poll.ballots.each do |b|
      next unless b.option_ids.intersect?(removed)

      left = b.option_ids - removed
      left.empty? ? b.destroy! : b.update_columns(option_ids: left)
    end
  end
end
