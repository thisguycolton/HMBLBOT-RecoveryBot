class CreateTags < ActiveRecord::Migration[8.0]
  def change
    create_table :tags do |t|
      t.string :title
      t.text :description
      t.string :icon
      t.string :slug

      t.timestamps
    end
  end
end
