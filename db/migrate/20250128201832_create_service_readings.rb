class CreateServiceReadings < ActiveRecord::Migration[7.0]
  def change
    create_table :service_readings do |t|
      t.string :title
      t.string :short_title
      t.string :source

      t.timestamps
    end
  end
end
