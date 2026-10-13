class CreateTextReports < ActiveRecord::Migration[8.0]
  def change
    create_table :text_reports do |t|
      t.references :user, null: false, foreign_key: true
      t.references :chapter, null: false, foreign_key: true
      t.jsonb :selector, null: false, default: {}
      t.text :message, null: false
      t.string :status, null: false, default: "open"
      t.datetime :resolved_at
      t.references :resolved_by, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :text_reports, [:status, :created_at]

    create_table :text_report_comments do |t|
      t.references :text_report, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.text :body, null: false
      t.timestamps
    end
  end
end
