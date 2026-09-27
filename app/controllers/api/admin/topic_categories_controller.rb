class Api::Admin::TopicCategoriesController < Api::Admin::BaseController
  before_action :set_category, only: %i[update destroy]

  def self.json(category, topics = nil)
    category.as_json(only: %i[id title cat icon_id icon_name]).merge(
      icon: category.icon&.as_json(only: %i[id name file_path]),
      topics: topics
    ).compact
  end

  def create
    category = TopicCategory.new(category_params)
    category.save ? render(json: self.class.json(category, 0), status: :created) : render_errors(category)
  end

  def update
    @category.update(category_params) ? render(json: self.class.json(@category, @category.topics.count)) : render_errors(@category)
  end

  # Its topics stay, moving to the Open Road (no category)
  def destroy
    TopicCategory.transaction do
      @category.topics.update_all(topic_category_id: nil)
      @category.destroy!
    end
    head :no_content
  end

  private

  def set_category
    @category = TopicCategory.find(params[:id])
  end

  def category_params
    params.require(:topic_category).permit(:title, :cat, :icon_id, :icon_name)
  end
end
