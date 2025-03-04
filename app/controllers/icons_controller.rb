class IconsController < ApplicationController
  def index
      @icons = Icon.all
      render json: @icons
  end
  def show
    @icon = Icon.find(params[:id])
    render json: @icon
  end
  def select
    selected_icon = Icon.find(params[:icon_id])
    # Do something with the selected icon, e.g., save it to a model
    redirect_to icons_path, notice: "Selected icon: #{selected_icon.name}"
  end
end
