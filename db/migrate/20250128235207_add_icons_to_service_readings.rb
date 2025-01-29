class AddIconsToServiceReadings < ActiveRecord::Migration[7.0]
  def change
    add_column :service_readings, :icon, :string
  end
end
