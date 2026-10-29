# Daily reminders to write a gratitude list (noon) and a 10th step inventory (6 PM), each
# off until turned on, at a time of day in the member's own time zone (RecoveryReminders)
class AddRecoveryRemindersToUsers < ActiveRecord::Migration[8.0]
  def change
    change_table :users, bulk: true do |t|
      t.boolean :gratitude_reminder, default: false, null: false
      t.string :gratitude_reminder_at, default: "12:00", null: false
      t.date :gratitude_reminded_on
      t.boolean :step_reminder, default: false, null: false
      t.string :step_reminder_at, default: "18:00", null: false
      t.date :step_reminded_on
      t.string :time_zone
    end
  end
end
