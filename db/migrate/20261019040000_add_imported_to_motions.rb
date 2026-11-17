# Motions brought in from old minutes keep saying so after a record keeper has checked them
class AddImportedToMotions < ActiveRecord::Migration[8.0]
  def up
    add_column :motions, :imported, :boolean, null: false, default: false
    execute "UPDATE motions SET imported = TRUE WHERE needs_review = TRUE"
  end

  def down
    remove_column :motions, :imported
  end
end
