# HostDeck: where a meeting's blocks go (hosting_layouts: one per meeting series, and the group's
# default with no meeting; none means the built-in "Host a meeting" template), kept apart from
# the kit so a meeting can have its own layout and still share the default's script and postings.
# groups.deck_editors: who in a group may rearrange its decks.
class AddHostdeckLayouts < ActiveRecord::Migration[8.0]
  def change
    create_table :hosting_layouts do |t|
      t.references :group, null: false, foreign_key: { on_delete: :cascade }
      t.references :meeting, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.jsonb :arrangement, null: false, default: {}
      t.references :updated_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.timestamps
    end
    add_index :hosting_layouts, :group_id, unique: true, where: "meeting_id IS NULL", name: "index_hosting_layouts_on_group_default"
    add_column :groups, :deck_editors, :string, array: true, null: false, default: %w[host_coordinators record_keepers]
  end
end
