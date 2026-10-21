# Which dynamic values (like {{ milestones }}) a kit offers in the document editor's
# Insert > Dynamic values toolbar; nil offers all of them
class AddAllowedValuesToHostingKits < ActiveRecord::Migration[8.0]
  def change
    add_column :hosting_kits, :allowed_values, :jsonb
  end
end
