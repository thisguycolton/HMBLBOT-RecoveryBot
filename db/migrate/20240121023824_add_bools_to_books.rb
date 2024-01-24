class AddBoolsToBooks < ActiveRecord::Migration[7.0]
  def change
    add_column :books, :aa_approved, :boolean
    add_column :books, :org_approved, :boolean
    add_column :books, :publicly_accessible, :boolean
  end
end
