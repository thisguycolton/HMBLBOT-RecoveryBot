# Group settings > "Show this group in search engines": on by default, so an approved group's
# public page and meetings can be found on Google (SearchEngines, GroupsController#app).
class AddSearchListedToGroups < ActiveRecord::Migration[8.0]
  def change
    add_column :groups, :search_listed, :boolean, default: true, null: false
  end
end
