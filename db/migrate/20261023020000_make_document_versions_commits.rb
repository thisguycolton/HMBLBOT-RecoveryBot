# Group document versions become saves you make on purpose, like commits: each row is now the
# document as someone saved it (numbered, with their note), not the copy a save replaced. The
# old rows already are what someone saved at that time, so they stay; each document gets one
# more row for its current text, so the newest version is always the document as it is.
# Also: comments on documents (off unless a document turns them on).
class MakeDocumentVersionsCommits < ActiveRecord::Migration[8.0]
  class Doc < ActiveRecord::Base
    self.table_name = "group_documents"
  end

  class Version < ActiveRecord::Base
    self.table_name = "group_document_versions"
  end

  def up
    change_table :group_document_versions, bulk: true do |t|
      t.integer :number
      t.string :message, limit: 280
      t.string :kind, null: false, default: "saved"
      t.bigint :restored_from_id
      t.bigint :contributor_ids, array: true, null: false, default: []
      t.integer :words_added, null: false, default: 0
      t.integer :words_removed, null: false, default: 0
      t.string :sections_changed, array: true, null: false, default: []
    end
    add_column :group_documents, :comment_mode, :string, null: false, default: "off"

    create_table :group_document_comments do |t|
      t.references :group_document, null: false, foreign_key: true
      t.references :user, foreign_key: { on_delete: :nullify }
      t.references :parent, foreign_key: { to_table: :group_document_comments, on_delete: :cascade }
      t.references :version, foreign_key: { to_table: :group_document_versions, on_delete: :nullify }
      t.text :body, null: false
      t.text :quote
      t.string :prefix
      t.string :suffix
      t.datetime :resolved_at
      t.references :resolved_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end

    Version.reset_column_information
    Doc.find_each { |doc| backfill(doc) }

    change_column_null :group_document_versions, :number, false
    add_index :group_document_versions, %i[group_document_id number], unique: true
  end

  def down
    remove_index :group_document_versions, %i[group_document_id number]
    drop_table :group_document_comments
    remove_column :group_documents, :comment_mode
    # The newest row of each is the document as it is (what up added, or a save since); the older rows stay
    execute <<~SQL.squish
      DELETE FROM group_document_versions v USING (SELECT group_document_id, MAX(number) AS n FROM group_document_versions GROUP BY 1) h
      WHERE v.group_document_id = h.group_document_id AND v.number = h.n
    SQL
    change_table :group_document_versions, bulk: true do |t|
      t.remove :number, :message, :kind, :restored_from_id, :contributor_ids, :words_added, :words_removed, :sections_changed
    end
  end

  private

  def backfill(doc)
    head = Version.create!(group_document_id: doc.id, user_id: doc.updated_by_id || doc.created_by_id, title: doc.title, body: doc.body,
                           body_format: doc.body_format, created_at: doc.updated_at, updated_at: doc.updated_at)
    copy_file(doc.id, head.id)

    previous = nil
    Version.where(group_document_id: doc.id).order(:created_at, :id).each_with_index do |v, i|
      attrs = { number: i + 1, kind: i.zero? ? "created" : "saved", contributor_ids: [v.user_id].compact }
      if previous
        stats = DocumentDiff.stats(previous.body, v.body, previous.body_format, v.body_format)
        attrs.merge!(words_added: stats[:words_added], words_removed: stats[:words_removed], sections_changed: stats[:sections])
      end
      v.update_columns(attrs)
      previous = v
    end
  end

  # The current file goes with the head version too (the same stored file, not a copy)
  def copy_file(doc_id, version_id)
    execute <<~SQL.squish
      INSERT INTO active_storage_attachments (name, record_type, record_id, blob_id, created_at)
      SELECT 'file', 'GroupDocumentVersion', #{version_id.to_i}, blob_id, created_at FROM active_storage_attachments
      WHERE record_type = 'GroupDocument' AND record_id = #{doc_id.to_i} AND name = 'file'
    SQL
  end
end
