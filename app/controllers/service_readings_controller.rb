class ServiceReadingsController < ApplicationController
  include KeepsRobotsOut
  keep_robots_out
  # Only site admins add, change or delete the service readings (the index and show pages hide the buttons too)
  before_action :authenticate_user!, only: %i[ new create edit update destroy ]
  before_action :require_admin!, only: %i[ new create edit update destroy ]
  before_action :set_service_reading, only: %i[ show edit update destroy ]
  layout "reader", only: %i[index show new edit]
  # GET /service_readings or /service_readings.json
  def index
    @service_readings = ServiceReading.order(:id)
  end

  # GET /service_readings/1 or /service_readings/1.json
  def show
    # The same reading from its other sources (How It Works from the Big Book and a pamphlet)
    @other_sources = ServiceReading.where(title: @service_reading.title).where.not(id: @service_reading.id).order(:id).select(:id, :source)
  end

  # GET /service_readings/new
  def new
    @service_reading = ServiceReading.new
  end

  # GET /service_readings/1/edit
  def edit
  end

  # POST /service_readings or /service_readings.json
  def create
    @service_reading = ServiceReading.new(service_reading_params)

    respond_to do |format|
      if @service_reading.save
        format.html { redirect_to service_reading_url(@service_reading), notice: "Service reading was successfully created." }
        # The React form (ServiceReadingEditor.jsx) goes to the reading itself; the notice shows there
        format.json do
          flash[:notice] = "Service reading was successfully created."
          render json: { id: @service_reading.id, redirect_url: service_reading_path(@service_reading) }, status: :created
        end
      else
        format.html { redirect_to new_service_reading_path, alert: @service_reading.errors.full_messages.to_sentence }
        format.json { render json: { errors: @service_reading.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /service_readings/1 or /service_readings/1.json
  def update
    respond_to do |format|
      if @service_reading.update(service_reading_params)
        format.html { redirect_to service_reading_url(@service_reading), notice: "Service reading was successfully updated." }
        format.json do
          flash[:notice] = "Service reading was successfully updated."
          render json: { id: @service_reading.id, redirect_url: service_reading_path(@service_reading) }, status: :ok
        end
      else
        format.html { redirect_to edit_service_reading_path(@service_reading), alert: @service_reading.errors.full_messages.to_sentence }
        format.json { render json: { errors: @service_reading.errors.full_messages }, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /service_readings/1 or /service_readings/1.json
  def destroy
    @service_reading.destroy

    respond_to do |format|
      format.html { redirect_to service_readings_url, notice: "Service reading was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    def require_admin!
      return if current_user&.admin?

      respond_to do |format|
        format.html { redirect_to service_readings_path, alert: "Only site admins can change service readings." }
        format.json { render json: { errors: ["Only site admins can change service readings."] }, status: :forbidden }
      end
    end

    # Use callbacks to share common setup or constraints between actions.
    def set_service_reading
      @service_reading = ServiceReading.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def service_reading_params
      params.require(:service_reading).permit(:title, :short_title, :body, :source, :icon)
    end
end
