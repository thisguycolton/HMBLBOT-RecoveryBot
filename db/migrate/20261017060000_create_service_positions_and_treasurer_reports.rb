# Group conscience, step four: service positions with who holds them and for how long (and a
# reminder as a term ends), and the treasurer's monthly report as numbers, not a document.
class CreateServicePositionsAndTreasurerReports < ActiveRecord::Migration[8.0]
  def change
    create_table :service_positions do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false
      t.text :description
      t.integer :term_months
      t.integer :sobriety_months
      t.integer :position, null: false, default: 0
      t.boolean :archived, null: false, default: false
      t.timestamps
    end

    # Names are plain text so a record never exposes an account; user_id is only so the holder
    # can be told their term is up
    create_table :service_terms do |t|
      t.references :service_position, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, foreign_key: { on_delete: :nullify }
      t.string :name, null: false
      t.date :starts_on, null: false
      t.date :ends_on
      t.datetime :reminded_at
      t.timestamps
    end

    create_table :treasurer_reports do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.date :period_on, null: false
      t.bigint :opening_cents, null: false, default: 0
      t.bigint :reserve_cents, null: false, default: 0
      # [{ kind: "income" | "expense", label, cents }]
      t.jsonb :lines, null: false, default: []
      # How what's above the prudent reserve is shared: [{ label, percent }]
      t.jsonb :splits, null: false, default: []
      t.text :notes
      t.string :status, null: false, default: "draft"
      t.string :visibility, null: false, default: "members"
      t.timestamps
    end
    add_index :treasurer_reports, %i[group_id period_on], unique: true
  end
end
