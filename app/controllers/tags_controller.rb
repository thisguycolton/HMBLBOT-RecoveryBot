class TagsController < ApplicationController
  before_action :authenticate_user!

  def index
    render json: Tag.order(:title).select(:id, :title, :slug)
  end

  def create
    # add your own admin check here if needed
    tag = Tag.new(tag_params)

    if tag.save
      render json: tag.slice(:id, :title, :slug), status: :created
    else
      render json: { errors: tag.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def tag_params
    params.require(:tag).permit(:title)
  end
end
