# Arranging the Today panel (TodayLayout): PUT saves which sections show and their order,
# DELETE goes back to the default. PeopleHome#json hands it to the panel as `layout`.
class Api::TodayLayoutsController < ApplicationController
  before_action :authenticate_user!

  # PUT /api/today_layout { order: [...], hidden: [...] }
  def update
    layout = TodayLayout.normalize(order: params[:order], hidden: params[:hidden])
    current_user.update_column(:today_layout, layout)
    render json: { layout: layout }
  end

  # DELETE /api/today_layout (Reset to default)
  def destroy
    current_user.update_column(:today_layout, nil)
    render json: { layout: nil }
  end
end
