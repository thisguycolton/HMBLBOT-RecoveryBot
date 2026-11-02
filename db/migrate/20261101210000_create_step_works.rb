# A member's work on a step from a worksheet (StepWork, StepTool), with its answers encrypted;
# and what a sponsee sends their sponsor is encrypted from now on too (SponsorshipShare)
class CreateStepWorks < ActiveRecord::Migration[8.0]
  def change
    create_table :step_works do |t|
      t.references :user, null: false, foreign_key: { on_delete: :cascade }
      t.integer :step, null: false
      t.string :tool_key
      t.string :name, null: false
      t.jsonb :definition, null: false, default: {}
      t.text :answers
      t.jsonb :settings, null: false, default: {}
      t.string :status, null: false, default: "in_progress"
      t.datetime :done_at
      t.timestamps
    end
    add_index :step_works, %i[user_id step updated_at]
  end
end
