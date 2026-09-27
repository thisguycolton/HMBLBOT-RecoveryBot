# JSON API behind the Topicificator admin (AdminPanel::TopicificatorController). Admins only.
class Api::Admin::BaseController < ApplicationController
  before_action :require_admin!

  rescue_from ActiveRecord::RecordNotFound, with: -> { render json: { error: "Not found" }, status: :not_found }

  private

  def require_admin!
    render json: { error: "Admins only" }, status: :forbidden unless current_user&.admin?
  end

  def render_errors(record)
    render json: { errors: record.errors.full_messages }, status: :unprocessable_entity
  end
end
