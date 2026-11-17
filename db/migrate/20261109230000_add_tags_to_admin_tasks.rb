# Site Admin > Task board: kanban tags on a task (Bug, Feature, Content...), shown as pills on
# its card. The list of tags is fixed in AdminTask::TAGS.
class AddTagsToAdminTasks < ActiveRecord::Migration[8.0]
  def change
    add_column :admin_tasks, :tags, :string, array: true, null: false, default: []
  end
end
