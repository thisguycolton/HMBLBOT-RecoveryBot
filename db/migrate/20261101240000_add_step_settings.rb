# Settings for step work: the 10th step's questions, changeable (users.inventory_questions,
# null for the Big Book's; step_inventories.questions, the set each night was written with),
# and per worksheet a reminder (a time, on some or all days) and sending it to their sponsor
# automatically when saved.
class AddStepSettings < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :inventory_questions, :jsonb
    add_column :step_inventories, :questions, :jsonb

    add_column :step_works, :remind_at, :string
    add_column :step_works, :remind_days, :integer, array: true, null: false, default: []
    add_column :step_works, :reminded_on, :date
    add_column :step_works, :auto_send, :boolean, null: false, default: false
    add_column :step_works, :auto_sent_at, :datetime
    add_index :step_works, :remind_at, where: "remind_at IS NOT NULL"
  end
end
