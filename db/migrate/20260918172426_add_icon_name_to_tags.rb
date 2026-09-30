class AddIconNameToTags < ActiveRecord::Migration[7.0]
  def change
    add_column :tags, :icon_name, :string
  end
end