class HostHelperController < ApplicationController
  layout "reader", only: %i[scratchpaper]
  def scratchpaper
  end
end
