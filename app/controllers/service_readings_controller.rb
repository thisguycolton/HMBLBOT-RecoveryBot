class ServiceReadingsController < ApplicationController
  before_action :set_service_reading, only: %i[ show edit update destroy ]

  # GET /service_readings or /service_readings.json
  def index
    @service_readings = ServiceReading.all

  end

  # GET /service_readings/1 or /service_readings/1.json
  def show
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
        format.json { render :show, status: :created, location: @service_reading }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @service_reading.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /service_readings/1 or /service_readings/1.json
  def update
    respond_to do |format|
      if @service_reading.update(service_reading_params)
        format.html { redirect_to service_reading_url(@service_reading), notice: "Service reading was successfully updated." }
        format.json { render :show, status: :ok, location: @service_reading }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @service_reading.errors, status: :unprocessable_entity }
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
    # Use callbacks to share common setup or constraints between actions.
    def set_service_reading
      @service_reading = ServiceReading.find(params[:id])
    end

    # Only allow a list of trusted parameters through.
    def service_reading_params
      params.require(:service_reading).permit(:title, :short_title, :body, :source, :icon)
    end
end
