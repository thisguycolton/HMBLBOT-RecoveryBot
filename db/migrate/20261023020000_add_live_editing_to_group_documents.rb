# Live editing (GroupDocument::Live): the shared copy everyone types into, as Yjs bytes, and the
# small edits that came in since that copy was last written down.
class AddLiveEditingToGroupDocuments < ActiveRecord::Migration[8.0]
  def change
    change_table :group_documents, bulk: true do |t|
      # every edit folded together, up to live_state_seq
      t.binary :live_state
      t.bigint :live_state_seq, null: false, default: 0
      # the number of the last edit that came in
      t.bigint :live_seq, null: false, default: 0
      # goes up whenever the text is replaced another way (a restore), so tabs still holding the
      # old copy start over instead of merging it back in
      t.integer :live_epoch, null: false, default: 0
      # live edits changed the text since the last Save version (so the next edit doesn't keep
      # another copy of what it had)
      t.boolean :live_unversioned, null: false, default: false
    end

    create_table :group_document_live_updates do |t|
      t.references :group_document, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :user, foreign_key: { on_delete: :nullify }
      t.bigint :seq, null: false
      t.binary :data, null: false
      t.datetime :created_at, null: false
      t.index %i[group_document_id seq], unique: true
    end
  end
end
