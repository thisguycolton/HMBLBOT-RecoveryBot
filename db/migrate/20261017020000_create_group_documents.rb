# Group conscience, step one: a group's documents (format, guidelines, treasurer's reports...)
# with their history, and record keepers (members allowed to write them).
class CreateGroupDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :group_memberships, :can_keep_records, :boolean, null: false, default: false

    create_table :group_documents do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :updated_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string :title, null: false
      t.string :kind, null: false, default: "other"
      t.text :body
      t.string :visibility, null: false, default: "members"
      t.string :status, null: false, default: "current"
      t.boolean :pinned, null: false, default: false
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :group_documents, %i[group_id kind position]

    # The copy a document had before a save: title and text, and its file if it had one
    create_table :group_document_versions do |t|
      t.references :group_document, null: false, foreign_key: { on_delete: :cascade }
      t.references :user, foreign_key: { on_delete: :nullify }
      t.string :title, null: false
      t.text :body
      t.timestamps
    end
  end
end
