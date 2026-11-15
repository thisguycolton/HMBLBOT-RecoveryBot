# Each member can arrange their Today panel (TodayLayout): which sections show and in what
# order. Nil until they customize it, so everyone else keeps the default.
class AddTodayLayoutToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :today_layout, :jsonb
  end
end
