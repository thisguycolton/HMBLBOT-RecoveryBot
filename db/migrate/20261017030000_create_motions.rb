# Group conscience, step two: the decisions log (one row per thing the group voted on), and
# the link from a document to the decision that adopted it.
class CreateMotions < ActiveRecord::Migration[8.0]
  def change
    create_table :motions do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :title, null: false
      t.text :text
      t.string :moved_by_name
      t.string :seconded_by_name
      t.string :status, null: false, default: "passed"
      # As counted in the room; nil when a past decision is typed in without a count
      t.integer :votes_for
      t.integer :votes_against
      t.integer :abstentions
      t.text :minority_opinion
      t.date :decided_on
      t.string :category, null: false, default: "other"
      # The earlier decision this one replaces
      t.references :supersedes, foreign_key: { to_table: :motions, on_delete: :nullify }
      t.string :visibility, null: false, default: "members"
      t.timestamps
    end
    add_index :motions, %i[group_id decided_on]

    add_reference :group_documents, :approved_by_motion, foreign_key: { to_table: :motions, on_delete: :nullify }
  end
end
