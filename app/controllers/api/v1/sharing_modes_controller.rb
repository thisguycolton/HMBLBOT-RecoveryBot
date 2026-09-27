class Api::V1::SharingModesController < ApplicationController
  def index
    render json: SharingMode.active.as_json(only: %i[key name icon_name prompt gentle])
  end
end
