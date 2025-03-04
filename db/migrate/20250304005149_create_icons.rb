class CreateIcons < ActiveRecord::Migration[8.0]
  def change
    create_table :icons do |t|
      t.string :name
      t.string :file_path
      t.string :category

      t.timestamps
    end
  end
end
