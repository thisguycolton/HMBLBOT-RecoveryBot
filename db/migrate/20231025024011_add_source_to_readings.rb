class AddSourceToReadings < ActiveRecord::Migration[7.0]
  def change
    add_column :readings, :source, :string
  end
end
