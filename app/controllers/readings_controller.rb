class ReadingsController < ApplicationController
  before_action :set_reading, only: %i[ show edit update destroy ]
  layout "reader", only: %i[new index show edit]


  # GET /readings or /readings.json
def index
  @readings = Reading.includes(:tags).order(created_at: :desc)

  if params[:tag].present?
    @selected_tag = Tag.find_by(slug: params[:tag]) || Tag.find_by(title: params[:tag])

    if @selected_tag
      @readings = @readings
        .joins(:tags)
        .where(tags: { id: @selected_tag.id })
        .distinct
    else
      @readings = @readings.none
    end
  end

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
      source: reading.source,
      host: reading.host,
      meetingName: reading.meetingName,
      meetingUrl: reading.meetingUrl,
      meetingDate: reading.meetingDate,
      meetingTime: reading.meetingTime&.strftime("%H:%M:%S"),
      preview: text.truncate(500),
      meeting_date_iso: reading.meetingDate.iso8601,
      path: reading_path(reading),
      tags: reading.tags.order(:title).map { |tag|
        { id: tag.id, title: tag.title, slug: tag.slug }
      }
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
    hour = @reading.meetingTime&.strftime("%-l")
    minute = @reading.meetingTime&.strftime("%M")
    meridiem = @reading.meetingTime&.strftime("%p")
    content = @reading.content&.body&.to_html
    topic = @reading.topic&.body&.to_s
  end

  # POST /readings or /readings.json
def create
  @reading = Reading.new(reading_params)
  @reading.user = current_user
  @reading.group_id ||= current_user.user_active_group&.group_id

  if @reading.save
    render json: { id: @reading.id }, status: :created
  else
    render json: { errors: @reading.errors.full_messages }, status: :unprocessable_entity
  end
end

def update
  @reading = Reading.find(params[:id])
  @reading.user = current_user
  @reading.group_id ||= current_user.user_active_group&.group_id

  if @reading.update(reading_params)
    render json: { id: @reading.id }, status: :ok
  else
    render json: { errors: @reading.errors.full_messages }, status: :unprocessable_entity
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
      params.require(:reading).permit(:title, :content, :topic, :user_id, :meetingTime, :meetingDate, :source, :meetingName, :meetingUrl, :host, :hour, :minute, :meridiem, :group_id, :richer_content, tag_ids: [])
    end
end
