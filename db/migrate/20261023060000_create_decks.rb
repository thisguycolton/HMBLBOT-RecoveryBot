# HostDeck beyond meetings: a deck of its own (a business meeting's, host onboarding...), run
# from one of the group's documents. Its live state is a hosting_session like a meeting's, one per
# date, so hosting_sessions belong to a meeting or a deck. block_state: what the blocks that keep
# something (a checklist's ticks, a timer) have, by block id, for decks and meetings alike.
class CreateDecks < ActiveRecord::Migration[8.0]
  def change
    create_table :decks do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.string :name, null: false
      t.string :purpose, null: false, default: "general"
      t.references :script_document, foreign_key: { to_table: :group_documents, on_delete: :nullify }
      t.jsonb :arrangement
      t.references :created_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end

    change_column_null :hosting_sessions, :meeting_id, true
    add_reference :hosting_sessions, :deck, foreign_key: { on_delete: :cascade }, index: false
    add_index :hosting_sessions, %i[deck_id on], unique: true
    add_check_constraint :hosting_sessions, "(meeting_id IS NULL) <> (deck_id IS NULL)", name: "hosting_sessions_meeting_or_deck"
    add_column :hosting_sessions, :block_state, :jsonb, null: false, default: {}
  end
end
