# "Needs your attention" items a member cleared from Today (TodayDuties), by the item's key. The
# title it had is kept too: when the item changes ("3 host places are open" becomes 4) it comes
# back. Restoring one deletes its row.
class CreateTodayDismissals < ActiveRecord::Migration[8.0]
  def change
    create_table :today_dismissals do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.string :key, null: false
      t.string :title, null: false
      t.timestamps
    end
    add_index :today_dismissals, %i[user_id key], unique: true
  end
end
