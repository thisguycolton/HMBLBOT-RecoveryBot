class HostificatorsController < ApplicationController
  before_action :set_hostificator, only: [:show, :vote]

  def new
    @hostificator = Hostificator.new
    3.times { @hostificator.host_props.build } # allow up to 3 proposals
  end

  def index
    @hostificators = Hostificator.all
  end

  def edit
    @hostificator = Hostificator.find(params[:id])
  end


  def create
    @hostificator = Hostificator.new(hostificator_params)
    if @hostificator.save
      redirect_to @hostificator
    else
      render :new
    end
  end
  def update
    @hostificator = Hostificator.find(params[:id])
    if @hostificator.update(hostificator_params)
      redirect_to @hostificator, notice: "Poll updated successfully."
    else
      render :edit
    end
  end

  def show
    @voted = HostVote.exists?(session_id: session.id.to_s, hostificator: @hostificator)
  end

  def vote
    @hostificator = Hostificator.find(params[:id])

    if HostVote.exists?(session_id: session.id.to_s, hostificator: @hostificator)
      redirect_to @hostificator, alert: "You've already voted."
      return
    end

    @host_vote = HostVote.new(
      hostificator: @hostificator,
      host_prop_id: params[:host_prop_id],
      session_id: session.id.to_s
    )

    if @host_vote.save
      redirect_to results_hostificator_path(@hostificator), notice: "Vote submitted!"
    else
      redirect_to @hostificator, alert: "There was an issue with your vote."
    end
  end


  def results
    @hostificator = Hostificator.find(params[:id])
    @host_props = @hostificator.host_props.includes(:host_votes)

    @results = @host_props.map do |prop|
      {
        prop: prop,
        vote_count: prop.host_votes.count
      }
    end

    @total_votes = @results.sum { |r| r[:vote_count] }
  end

  private

  def set_hostificator
    @hostificator = Hostificator.find(params[:id])
  end

  def hostificator_params
    params.require(:hostificator).permit(
      :meeting_date_time,
      host_props_attributes: [:id, :name, :proposed_meeting, :_destroy]
    )
  end

end
