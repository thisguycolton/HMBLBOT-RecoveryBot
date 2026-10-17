# Everything the Topicificator admin needs to draw its filters and pickers, in one request
class Api::Admin::MetaController < Api::Admin::BaseController
  # GET /api/admin/meta
  def show
    set_counts = Topic.group(:topic_set_id).count
    category_counts = Topic.group(:topic_category_id).count
    render json: {
      topic_sets: TopicSet.order(:id).map { |s| s.as_json(only: %i[id name description]).merge(topics: set_counts[s.id] || 0) },
      categories: TopicCategory.includes(:icon).order(:id).map { |c| Api::Admin::TopicCategoriesController.json(c, category_counts[c.id] || 0) },
      uncategorized: category_counts[nil] || 0,
      sharing_modes: SharingMode.order(:position).as_json(only: %i[id key name prompt gentle icon_name active]),
      tags: Tag.alphabetical.as_json(only: %i[id title]),
      difficulties: Topic::DIFFICULTIES,
    }
  end
end
