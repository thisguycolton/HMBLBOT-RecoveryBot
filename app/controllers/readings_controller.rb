class ReadingsController < ApplicationController
  before_action :set_reading, only: %i[ show edit update destroy ]

  # GET /readings or /readings.json
  def index
    @q = Reading.ransack(params[:q])
    @readings = @q.result(distinct: true).order(meetingDate: :desc)

    @readings_json = @readings.map do |reading|
      text =
        if reading.richer_content&.id.present?
          reading.richer_content.to_plain_text
        elsif reading.content.present?
          reading.content.to_plain_text
        else
          ""
        end

      {
        id: reading.id,
        title: reading.title,
        source: reading.source.to_s.truncate(72),
        meeting_date: reading.meetingDate.strftime("%b-%d-%y"),
        meeting_date_iso: reading.meetingDate.iso8601,
        path: reading_path(reading),
        preview: text.truncate(500)
      }
    end
  end
  # GET /readings/1 or /readings/1.json
  def show
     ahoy.track "Viewed Reading", title: @reading.title
  end

  # GET /readings/new
  def new
    @reading = Reading.new
    @polls = Poll.all.order(updated_at: :desc)
  end

  # GET /readings/1/edit
  def edit
  end

  # POST /readings or /readings.json
  def create
    @reading = Reading.new(reading_params)

    respond_to do |format|
      if @reading.save
        format.html { redirect_to reading_url(@reading), notice: "Reading was successfully created." }
        format.json { render :show, status: :created, location: @reading }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @reading.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /readings/1 or /readings/1.json
  def update
    respond_to do |format|
      if @reading.update(reading_params)
        format.html { redirect_to reading_url(@reading), notice: "Reading was successfully updated." }
        format.json { render :show, status: :ok, location: @reading }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @reading.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /readings/1 or /readings/1.json
  def destroy
    @reading.destroy

    respond_to do |format|
      format.html { redirect_to readings_url, notice: "Reading was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_reading
      @reading = Reading.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def reading_params
      params.require(:reading).permit(:title, :content, :topic, :user_id, :meetingTime, :meetingDate, :source, :meetingName, :meetingUrl, :host, :hour, :minute, :meridiem, :group_id, :richer_content)
    end
end
