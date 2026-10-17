class AddSobrietyDateToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :sobriety_date, :date
    # Private unless they choose to show it to the people in their groups
    add_column :users, :show_sobriety_date, :boolean, null: false, default: false
  end
end
