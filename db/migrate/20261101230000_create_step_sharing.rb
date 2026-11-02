# Sharing worksheets (never answers): a sponsor suggesting their copy of a worksheet to a
# sponsee (step_suggestions), a group publishing worksheets for a step study
# (group_step_tools), and which step a sponsee is on (sponsorships.current_step).
class CreateStepSharing < ActiveRecord::Migration[8.0]
  def change
    create_table :step_suggestions do |t|
      t.references :sponsorship, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.integer :step, null: false
      t.string :tool_key
      t.text :note
      t.jsonb :definition, null: false, default: {}
      t.datetime :started_at
      t.timestamps
    end

    create_table :group_step_tools do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :name, null: false
      t.integer :step, null: false
      t.string :tool_key
      t.text :summary
      t.jsonb :definition, null: false, default: {}
      t.timestamps
    end

    add_column :sponsorships, :current_step, :integer
  end
end
