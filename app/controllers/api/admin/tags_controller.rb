# Reading tags with their icons (Lucide names; the reading cards show them).
class Api::Admin::TagsController < Api::Admin::SuiteController
  def index
    counts = ReadingTag.group(:tag_id).count
    render json: Tag.order(:title).map { |tag| tag_json(tag, counts[tag.id].to_i) }
  end

  def create
    tag = Tag.new(tag_params)
    tag.save ? render(json: tag_json(tag, 0), status: :created) : render_errors(tag)
  end

  def update
    tag = Tag.find(params[:id])
    tag.update(tag_params) ? render(json: tag_json(tag, tag.reading_tags.count)) : render_errors(tag)
  end

  # Removes the tag from its readings too; the readings stay
  def destroy
    Tag.find(params[:id]).destroy!
    head :no_content
  end

  private

  def tag_params
    params.require(:tag).permit(:title, :icon_name)
  end

  def tag_json(tag, readings_count)
    { id: tag.id, title: tag.title, slug: tag.slug, icon_name: tag.icon_name, readings_count: readings_count }
  end
end
